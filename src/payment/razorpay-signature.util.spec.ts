import * as crypto from 'crypto';
import { verifyRazorpaySignature } from './razorpay-signature.util';

const SECRET = 'test_secret_for_signature_checks';

const sign = (orderId: string, paymentId: string, secret = SECRET) =>
  crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

describe('verifyRazorpaySignature', () => {
  const original = process.env.RAZORPAY_KEY_SECRET;

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.RAZORPAY_KEY_SECRET = original;
  });

  it('accepts a signature produced with the gateway secret', () => {
    expect(
      verifyRazorpaySignature({
        razorpay_order_id: 'order_A1',
        razorpay_payment_id: 'pay_B2',
        razorpay_signature: sign('order_A1', 'pay_B2'),
      }),
    ).toBe(true);
  });

  it('rejects a signature made with the wrong secret', () => {
    expect(
      verifyRazorpaySignature({
        razorpay_order_id: 'order_A1',
        razorpay_payment_id: 'pay_B2',
        razorpay_signature: sign('order_A1', 'pay_B2', 'not_the_secret'),
      }),
    ).toBe(false);
  });

  it('rejects a signature lifted from a different payment', () => {
    expect(
      verifyRazorpaySignature({
        razorpay_order_id: 'order_A1',
        razorpay_payment_id: 'pay_B2',
        razorpay_signature: sign('order_A1', 'pay_SOMEONE_ELSE'),
      }),
    ).toBe(false);
  });

  it('rejects missing fields and malformed signatures', () => {
    expect(verifyRazorpaySignature({})).toBe(false);
    expect(
      verifyRazorpaySignature({
        razorpay_order_id: 'order_A1',
        razorpay_payment_id: 'pay_B2',
        razorpay_signature: 'too-short',
      }),
    ).toBe(false);
  });

  it('rejects everything when no gateway secret is configured', () => {
    delete process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_SECRET;

    expect(
      verifyRazorpaySignature({
        razorpay_order_id: 'order_A1',
        razorpay_payment_id: 'pay_B2',
        razorpay_signature: sign('order_A1', 'pay_B2'),
      }),
    ).toBe(false);
  });
});
