interface TestOrderRecord {
  amount: number;
  createdAt: number;
}

const testOrdersMap = new Map<string, TestOrderRecord>();

export function registerTestOrder(orderId: string, amount: number): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, rec] of testOrdersMap.entries()) {
    if (rec.createdAt < cutoff) testOrdersMap.delete(id);
  }
  testOrdersMap.set(orderId, { amount, createdAt: Date.now() });
}

export function getTestOrder(orderId: string): TestOrderRecord | undefined {
  return testOrdersMap.get(orderId);
}
