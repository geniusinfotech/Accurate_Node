/* eslint-disable prettier/prettier */
// Load .env here: this module is imported (and these values read) before
// ConfigModule.forRoot() runs, so without it a .env-only deploy would silently
// sign tokens with a fallback secret. No fallbacks — missing secrets must fail boot.
import 'dotenv/config';

function secret(name: 'JWT_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 characters`);
  }
  return value;
}

export const jwtConstants = {
  secret: secret('JWT_SECRET'),
  expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshSecret: secret('JWT_REFRESH_SECRET'),
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
};
