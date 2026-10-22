import * as crypto from 'crypto';
import { OrdersService } from './orders.service';
import * as razorpayClient from '../payment/razorpay-client.util';

/**
 * The checkout page quotes the customer from the `shipping` setting and a 10%
 * discount over ₹1000, then hands that total to Razorpay. These pin the server
 * to the same rule — when it priced orders its own way ("free over ₹1000, else
 * ₹50") the customer was charged one amount and the order recorded another.
 *
 * The mirrored expectations below are transcribed from app/checkout/page.tsx;
 * changing the rule means changing both.
 */
const createService = (shippingRules: any) => {
  const settingsService: any = {
    getSetting: jest.fn().mockResolvedValue(shippingRules),
  };

  const couponsService: any = {
    calculateCouponDiscount: jest.fn().mockResolvedValue({ discount: 0 }),
  };

  const service = new OrdersService({} as any, {} as any, {} as any, settingsService, couponsService);

  return { service, settingsService };
};

const RULES = { default: 99, '380001': 0, '395009': 49, '360001': 69 };

const checkoutQuote = (subtotal: number, pincode: string) => {
  const rules: Record<string, number> = RULES as any;
  const shipping = rules[pincode] !== undefined ? rules[pincode] : rules.default;
  const discount = subtotal > 1000 ? Number((subtotal * 0.1).toFixed(2)) : 0;
  return {
    shippingCost: shipping,
    discount,
    totalAmount: Number((subtotal + shipping - discount).toFixed(2)),
  };
};

describe('OrdersService.quoteOrder', () => {
  it('charges the pincode override when there is one', async () => {
    const { service } = createService(RULES);

    await expect(service.quoteOrder(399, '395009')).resolves.toEqual(
      checkoutQuote(399, '395009'),
    );
  });

  it('honours a ₹0 override instead of treating it as missing', async () => {
    const { service } = createService(RULES);

    const quote = await service.quoteOrder(798, '380001');

    expect(quote.shippingCost).toBe(0);
    expect(quote).toEqual(checkoutQuote(798, '380001'));
  });

  it('falls back to the configured default for an unlisted pincode', async () => {
    const { service } = createService(RULES);

    await expect(service.quoteOrder(6598, '110011')).resolves.toEqual(
      checkoutQuote(6598, '110011'),
    );
  });

  it('still charges pincode shipping on a cart over ₹1000', async () => {
    const { service } = createService(RULES);

    const quote = await service.quoteOrder(2499, '360001');

    // The old rule made shipping free above ₹1000 and recorded ₹2249.
    expect(quote).toEqual({
      shippingCost: 69,
      discount: 249.9,
      totalAmount: 2318.1,
    });
  });

  it('applies no discount at exactly ₹1000 and 10% just above it', async () => {
    const { service } = createService(RULES);

    await expect(
      service.quoteOrder(1000, '395009'),
    ).resolves.toMatchObject({ discount: 0 });
    await expect(
      service.quoteOrder(1000.5, '395009'),
    ).resolves.toMatchObject({ discount: 100.05 });
  });

  it('keeps discounts to paise rather than whole rupees', async () => {
    const { service } = createService(RULES);

    // Math.round() here used to cost or gain the customer up to 50 paise.
    await expect(service.quoteOrder(1199, '360001')).resolves.toMatchObject({
      discount: 119.9,
    });
  });

  it('falls back to ₹100 when no shipping setting exists', async () => {
    const { service } = createService(null);

    await expect(service.quoteOrder(500, '395009')).resolves.toMatchObject({
      shippingCost: 100,
    });
  });

  it('falls back to ₹100 rather than trusting a malformed rule', async () => {
    const { service } = createService({ default: 'free' });

    await expect(service.quoteOrder(500, '999999')).resolves.toMatchObject({
      shippingCost: 100,
    });
  });

  it('does not fail the order when the settings lookup throws', async () => {
    const { service } = createService(undefined);
    (service as any).settingsService.getSetting = jest
      .fn()
      .mockRejectedValue(new Error('mongo down'));

    await expect(service.quoteOrder(500, '395009')).resolves.toMatchObject({
      shippingCost: 100,
      totalAmount: 600,
    });
  });
});

describe('OrdersService payment confirmation', () => {
  const SECRET = 'spec_secret_for_orders';
  const PRODUCT_ID = '6aa52d03c0fa435a21c26736';
  // 2499 - 249.90 discount + 69 shipping = 2318.10 -> 231810 paise
  const EXPECTED_PAISE = 231810;

  const sign = (orderId: string, paymentId: string) =>
    crypto
      .createHmac('sha256', SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

  const createWithGateway = (fetchOrder: jest.Mock | null) => {
    const settingsService: any = {
      getSetting: jest.fn().mockResolvedValue(RULES),
    };
    const productModel: any = {
      findById: () => ({
        select: () => ({
          lean: () => ({
            exec: async () => ({
              _id: PRODUCT_ID,
              name: 'Ring',
              sku: 'SKU1',
              images: [],
              price: 2499,
              isActive: true,
              status: 'published',
            }),
          }),
        }),
      }),
    };
    function OrderModel(this: any, doc: any) {
      Object.assign(this, doc);
      this.save = async () => this;
    }
    (OrderModel as any).countDocuments = async () => 0;

    jest
      .spyOn(razorpayClient, 'getRazorpayInstance')
      .mockReturnValue(
        fetchOrder ? ({ orders: { fetch: fetchOrder } } as any) : null,
      );

    return new OrdersService(OrderModel as any, productModel, {} as any, settingsService, {
      calculateCouponDiscount: jest.fn().mockResolvedValue({ discount: 0 }),
    } as any);
  };

  const orderDto = (signature?: string) => ({
    customerName: 'Buyer',
    phone: '9999900000',
    address: '1 Test Lane',
    pincode: '360001',
    items: [
      { productId: PRODUCT_ID, name: 'Ring', quantity: 1, price: 2499 },
    ],
    razorpay_order_id: 'order_live1',
    razorpay_payment_id: 'pay_live1',
    razorpay_signature: signature ?? sign('order_live1', 'pay_live1'),
  });

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
  });

  afterEach(() => jest.restoreAllMocks());

  it('records paid when the gateway holds the order total', async () => {
    const fetchOrder = jest.fn().mockResolvedValue({ amount: EXPECTED_PAISE });
    const service = createWithGateway(fetchOrder);

    const order: any = await service.create(orderDto() as any);

    expect(fetchOrder).toHaveBeenCalledWith('order_live1');
    expect(order.totalAmount).toBe(2318.1);
    expect(order.paymentStatus).toBe('paid');
    expect(order.paymentId).toBe('pay_live1');
  });

  it('leaves the order unpaid when a cheaper payment is presented', async () => {
    // Paid ₹468 for a small cart, then posted this ₹2318.10 one with the same
    // signature — the swap the amount check exists to catch.
    const service = createWithGateway(
      jest.fn().mockResolvedValue({ amount: 46800 }),
    );

    const order: any = await service.create(orderDto() as any);

    expect(order.paymentStatus).toBe('pending');
    expect(order.paymentId).toBe('');
  });

  it('leaves the order unpaid when the gateway does not know the payment', async () => {
    const service = createWithGateway(
      jest.fn().mockRejectedValue(new Error('not a valid id')),
    );

    await expect(service.create(orderDto() as any)).resolves.toMatchObject({
      paymentStatus: 'pending',
    });
  });

  it('leaves the order unpaid when the gateway is not configured', async () => {
    const service = createWithGateway(null);

    await expect(service.create(orderDto() as any)).resolves.toMatchObject({
      paymentStatus: 'pending',
    });
  });

  it('never asks the gateway when the signature is forged', async () => {
    const fetchOrder = jest.fn().mockResolvedValue({ amount: EXPECTED_PAISE });
    const service = createWithGateway(fetchOrder);

    const order: any = await service.create(orderDto('deadbeef') as any);

    expect(fetchOrder).not.toHaveBeenCalled();
    expect(order.paymentStatus).toBe('pending');
  });
});

describe('OrdersService.getSummary revenue', () => {
  const order = (totalAmount: number, orderStatus: string, paymentStatus: string) => ({
    totalAmount,
    orderStatus,
    paymentStatus,
  });

  it('counts paid and delivered-COD orders, not cancelled or open COD', async () => {
    const all = [
      order(100, 'placed', 'paid'), // prepaid
      order(200, 'delivered', 'pending'), // COD collected on delivery
      order(400, 'placed', 'pending'), // COD not yet delivered
      order(800, 'cancelled', 'paid'), // refunded/cancelled
    ];
    const orderModel: any = {
      find: jest.fn(() => ({ exec: () => Promise.resolve(all) })),
    };
    const service = new OrdersService(orderModel, {} as any, {} as any, {} as any, {
      calculateCouponDiscount: jest.fn().mockResolvedValue({ discount: 0 }),
    } as any);

    const summary = await service.getSummary();

    expect(summary.totalWebRevenue).toBe(300);
    expect(summary.totalOrdersCount).toBe(4);
  });
});

describe('OrdersService shipping rules from the admin screen', () => {
  it('uses flatRate, and ships free at or above freeShippingAbove', async () => {
    const { service } = createService({ flatRate: 49, freeShippingAbove: 500 });

    expect((await service.quoteOrder(499, '395007')).shippingCost).toBe(49);
    expect((await service.quoteOrder(500, '395007')).shippingCost).toBe(0);
  });

  it('treats freeShippingAbove 0 as off and lets a pincode override win', async () => {
    const { service } = createService({ flatRate: 60, freeShippingAbove: 0, '110011': 120 });

    expect((await service.quoteOrder(5000, '395007')).shippingCost).toBe(60);
    expect((await service.quoteOrder(5000, '110011')).shippingCost).toBe(120);
  });
});
