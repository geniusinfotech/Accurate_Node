import type { NextFunction, Request, Response } from 'express';

/** True if any object in the value has a key starting with "$" (a Mongo operator such as $ne, $gt, $where). */
export function hasMongoOperator(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object' || depth > 8) return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, v]) => key.startsWith('$') || hasMongoOperator(v, depth + 1),
  );
}

/**
 * NoSQL-injection guard for every route: `?status[$ne]=x` or `{"email":{"$gt":""}}` would otherwise
 * reach the database as a query operator. No legitimate request here contains "$" keys.
 */
export function noMongoOperators(req: Request, res: Response, next: NextFunction) {
  if (hasMongoOperator(req.query) || hasMongoOperator(req.body)) {
    return res.status(400).json({ statusCode: 400, response: 'Invalid request' });
  }
  next();
}
