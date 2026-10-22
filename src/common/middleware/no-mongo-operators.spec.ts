import { hasMongoOperator } from './no-mongo-operators';

describe('NoSQL operator guard', () => {
  it('flags operators anywhere in the structure', () => {
    expect(hasMongoOperator({ email: { $ne: null } })).toBe(true);
    expect(hasMongoOperator({ a: [{ b: { $gt: '' } }] })).toBe(true);
    expect(hasMongoOperator({ $where: '1' })).toBe(true);
  });
  it('lets normal input through', () => {
    expect(hasMongoOperator({ email: 'a@b.co', items: [{ productId: 'x', quantity: 2 }], note: 'cost $5' })).toBe(false);
    expect(hasMongoOperator('plain')).toBe(false);
    expect(hasMongoOperator(undefined)).toBe(false);
  });
});
