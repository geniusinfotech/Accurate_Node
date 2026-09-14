import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { jwtConstants } from './constants';
import type { Request } from 'express';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          // Prefer explicit cookie parsing via cookieParser if available
          const cookies = (request as any)?.cookies as
            | Record<string, string>
            | undefined;
          if (cookies?.glitera_access_token)
            return cookies.glitera_access_token;
          // Fallback: manual parse with safe decode
          const cookieHeader = request?.headers?.cookie;
          if (!cookieHeader) return null;
          for (const part of cookieHeader.split(';')) {
            const idx = part.indexOf('=');
            if (idx === -1) continue;
            const k = part.slice(0, idx).trim();
            if (k !== 'glitera_access_token') continue;
            const raw = part.slice(idx + 1).trim();
            try {
              return decodeURIComponent(raw);
            } catch {
              return raw;
            }
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtConstants.secret,
      algorithms: ['HS256'],
      issuer: undefined,
      audience: undefined,
    });
  }

  validate(payload: any) {
    if (!payload?.sub || typeof payload.sub !== 'string') return null as any;
    return {
      userId: payload.sub,
      _id: payload.sub,
      sub: payload.sub,
      username: payload.username,
      email: payload.email,
      roles: Array.isArray(payload.roles) ? payload.roles : [],
    };
  }
}
