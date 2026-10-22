import * as crypto from 'crypto';
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { verifyRazorpaySignature } from './razorpay-signature.util';
import {
  getRazorpayInstance,
  getRazorpayKeyId,
  getRazorpayKeySecret,
  toPaise,
} from './razorpay-client.util';
import { registerTestOrder } from './test-orders.store';
import { OrdersService } from '../orders/orders.service';
import { CreatePaymentOrderDto } from './dto/create-payment-order.dto';
import { APISuccess, APIError } from '../common/api-response';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString } from 'class-validator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

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

class DevSignBody {
  @IsString()
  @IsNotEmpty()
  razorpay_order_id: string;

  @IsString()
  @IsNotEmpty()
  razorpay_payment_id: string;
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
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async createOrder(@Body() body: CreatePaymentOrderDto, @Req() req: any) {
    const currency = body.currency || 'INR';
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw APIError.badRequest('Invalid currency');
    }

    const userId =
      req?.user?.userId || req?.user?.sub || req?.user?.id || req?.user?._id;

    const quote = await this.ordersService.quoteCart(
      body.items as any,
      body.pincode.trim(),
      body.couponCode?.trim(),
      userId,
    );
    if (!Number.isFinite(quote.totalAmount) || quote.totalAmount < 0) {
      throw APIError.badRequest('Invalid amount');
    }
    if (quote.totalAmount > 1000000) {
      throw APIError.badRequest('Order total exceeds the payment limit');
    }

    const isNonProd = process.env.NODE_ENV !== 'production';

    try {
      const instance = getRazorpayInstance();
      if (!instance) {
        if (isNonProd) {
          return this.createDevTestOrder(quote, currency);
        }
        throw APIError.internalServerError('Payment gateway not configured');
      }
      const order = await instance.orders.create({
        amount: toPaise(quote.totalAmount),
        currency,
        receipt: `receipt_${Date.now()}`,
      });
      return {
        ...order,
        key: getRazorpayKeyId(),
        // Echoed back so the checkout screen shows the figure being charged.
        quote: {
          subtotal: quote.subtotal,
          shippingCost: quote.shippingCost,
          discount: quote.discount,
          totalAmount: quote.totalAmount,
          couponDiscount: quote.couponDiscount,
          couponCode: quote.couponCode,
        },
      };
    } catch (err: any) {
      // In development mode, if gateway credentials fail authentication or fail connecting,
      // fall back to a registered test order so development and QA testing are never blocked.
      if (isNonProd && !(err instanceof APIError)) {
        return this.createDevTestOrder(quote, currency);
      }

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

  private createDevTestOrder(
    quote: {
      subtotal: number;
      shippingCost: number;
      discount: number;
      totalAmount: number;
      couponDiscount?: number;
      couponCode?: string;
    },
    currency: string,
  ) {
    const testOrderId = `order_test_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const paise = toPaise(quote.totalAmount);
    registerTestOrder(testOrderId, paise);
    return {
      id: testOrderId,
      entity: 'order',
      amount: paise,
      amount_paid: 0,
      amount_due: paise,
      currency,
      receipt: `receipt_${Date.now()}`,
      status: 'created',
      attempts: 0,
      notes: [],
      created_at: Math.floor(Date.now() / 1000),
      key: getRazorpayKeyId() || 'rzp_test_accurate_dev',
      quote: {
        subtotal: quote.subtotal,
        shippingCost: quote.shippingCost,
        discount: quote.discount,
        totalAmount: quote.totalAmount,
        couponDiscount: quote.couponDiscount,
        couponCode: quote.couponCode,
      },
      isSandbox: true,
    };
  }

  @Post('verify')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async verifyPayment(@Body() body: VerifyBody) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      body || ({} as any);
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw APIError.badRequest('Missing payment verification fields');
    }
    const secret = getRazorpayKeySecret();
    if (!secret && process.env.NODE_ENV === 'production') {
      throw APIError.internalServerError('Payment gateway not configured');
    }
    // All orders must be verified via HMAC
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

  /**
   * Generates a valid HMAC signature for test orders in development mode.
   * Kept on the server so the secret is never leaked to the client.
   */
  @Post('dev-sign-test')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async devSignTest(@Body() body: DevSignBody) {
    if (process.env.NODE_ENV === 'production') {
      throw APIError.forbidden('Test signatures are disabled in production');
    }
    const { razorpay_order_id, razorpay_payment_id } = body;
    if (!razorpay_order_id.startsWith('order_test_')) {
      throw APIError.badRequest('Only test orders can be signed with dev-sign-test');
    }
    const secret =
      getRazorpayKeySecret() ||
      'test_secret_for_signature_checks';
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const signature = hmac.digest('hex');
    return {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: signature,
    };
  }
}
