import Razorpay from 'razorpay';

/**
 * Normalizes Razorpay Key ID, trimming whitespace and fixing common accidental typos (e.g. double r).
 */
export function getRazorpayKeyId(): string {
  let key_id = (process.env.RAZORPAY_KEY_ID || '').trim();
  if (key_id.startsWith('rrzp_')) {
    key_id = key_id.replace(/^r+zp_/, 'rzp_');
  }
  return key_id;
}

/**
 * Returns trimmed Razorpay Key Secret.
 */
export function getRazorpayKeySecret(): string {
  return (
    process.env.RAZORPAY_KEY_SECRET ||
    process.env.RAZORPAY_SECRET ||
    ''
  ).trim();
}

/**
 * Returns a Razorpay client, or null when the gateway is not configured.
 * Shared so the payment controller and the orders service talk to the same
 * account — an order must be checked against the gateway that charged it.
 */
export function getRazorpayInstance(): Razorpay | null {
  const key_id = getRazorpayKeyId();
  const key_secret = getRazorpayKeySecret();
  if (!key_id || !key_secret || !key_id.startsWith('rzp_')) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

/** Razorpay works in paise; our totals are in rupees. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

