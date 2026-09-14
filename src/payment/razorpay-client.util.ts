import Razorpay from 'razorpay';

/**
 * Returns a Razorpay client, or null when the gateway is not configured.
 * Shared so the payment controller and the orders service talk to the same
 * account — an order must be checked against the gateway that charged it.
 */
export function getRazorpayInstance(): Razorpay | null {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret =
    process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
  if (!key_id || !key_secret || !key_id.startsWith('rzp_')) {
    return null;
  }
  return new Razorpay({ key_id, key_secret });
}

/** Razorpay works in paise; our totals are in rupees. */
export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}
