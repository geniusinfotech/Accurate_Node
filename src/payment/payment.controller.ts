import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { verifyRazorpaySignature } from './razorpay-signature.util';
import { getRazorpayInstance, toPaise } from './razorpay-client.util';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { APISuccess, APIError } from '../common/api-response';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString } from 'class-validator';

// Needs validators: the global ValidationPipe is whitelist + forbidNonWhitelisted,
// so an undecorated class rejects every request with 400.
class VerifyBody {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_signature: string;
}

@Controller('payment')
export class PaymentController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Opens a Razorpay order for the amount the cart actually comes to. The
   * client sends what it wants to buy and where it is going, never a price —
   * OrdersService re-prices it from the catalogue and the shipping rules, and
   * that same calculation is what the recorded order is checked against.
   */
  @Post('create-order')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createOrder(@Body() body: CreatePaymentOrderDto) {
    const currency = body.currency || 'INR';
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw APIError.badRequest('Invalid currency');
    }

    const quote = await this.ordersService.quoteCart(
      body.items as any,
      body.pincode.trim(),
    );
    if (!Number.isFinite(quote.totalAmount) || quote.totalAmount <= 0) {
      throw APIError.badRequest('Invalid amount');
    }
    if (quote.totalAmount > 1000000) {
      throw APIError.badRequest('Order total exceeds the payment limit');
    }

    try {
      const instance = getRazorpayInstance();
      if (!instance) {
        throw APIError.internalServerError('Payment gateway not configured');
      }
      const order = await instance.orders.create({
        amount: toPaise(quote.totalAmount),
        currency,
        receipt: `receipt_${Date.now()}`,
      });
      return {
        ...order,
        key: process.env.RAZORPAY_KEY_ID,
        // Echoed back so the checkout screen shows the figure being charged.
        quote: {
          subtotal: quote.subtotal,
          shippingCost: quote.shippingCost,
          discount: quote.discount,
          totalAmount: quote.totalAmount,
        },
      };
    } catch (err: any) {
      // Preserve our own APIErrors; map upstream Razorpay failures to 502
      // (they are gateway problems, not internal bugs). Razorpay SDK errors
      // carry statusCode (e.g. 401 on bad keys) — don't leak them as 500.
      if (err instanceof APIError) throw err;
      const msg =
        err?.error?.description ||
        err?.message ||
        'Error creating Razorpay order';
      throw APIError.badGateway(`Payment gateway error: ${msg}`, err);
    }
  }

  @Post('verify')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verifyPayment(@Body() body: VerifyBody) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      body || ({} as any);
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw APIError.badRequest('Missing payment verification fields');
    }
    const secret =
      process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';
    if (!secret) {
      throw APIError.internalServerError('Payment gateway not configured');
    }
    // No mock bypass — all orders must be verified via HMAC
    const isValid = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (isValid) {
      return { verified: true };
    } else {
      throw APIError.badRequest('Invalid signature');
    }
  }
}
