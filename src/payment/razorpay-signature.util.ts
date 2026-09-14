import * as crypto from 'crypto';

export interface RazorpaySignatureFields {
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_signature?: string;
}

/**
 * Re-computes Razorpay's HMAC over `order_id|payment_id` and compares it in
 * constant time. This is the only thing that may mark money as received — a
 * client claiming `paymentStatus: 'paid'` is never enough.
 */
export function verifyRazorpaySignature(
  fields: RazorpaySignatureFields,
): boolean {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    fields || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  const secret =
    process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET || '';
  if (!secret) return false;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const expected = hmac.digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8'),
    );
  } catch {
    return false;
  }
}
