/* eslint-disable prettier/prettier */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Additional security headers not covered by Helmet

        // Expect-CT header for Certificate Transparency
        res.setHeader('Expect-CT', 'max-age=86400, enforce');

        // X-Permitted-Cross-Domain-Policies
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

        // Clear-Site-Data on logout endpoints
        if (req.path.includes('/logout')) {
            res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');
        }

        // Add Request ID for tracing
        const requestId = req.headers['x-request-id'] || this.generateRequestId();
        res.setHeader('X-Request-Id', requestId as string);

        next();
    }

    private generateRequestId(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    }
}
