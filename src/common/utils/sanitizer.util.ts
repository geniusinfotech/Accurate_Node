/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';

@Injectable()
export class SanitizerUtil {
    /**
     * Sanitize string to prevent MongoDB injection
     */
    sanitizeMongoQuery(value: any): any {
        if (typeof value === 'string') {
            // Remove MongoDB operators
            const dangerousOperators = ['$where', '$regex', '$ne', '$gt', '$gte', '$lt', '$lte', '$in', '$nin', '$or', '$and', '$not', '$nor', '$exists', '$type', '$expr', '$jsonSchema', '$mod', '$text', '$elemMatch'];
            let sanitized = value;
            dangerousOperators.forEach(op => {
                sanitized = sanitized.replace(new RegExp(`\\${op}`, 'gi'), '');
            });
            return sanitized;
        }

        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                return value.map(item => this.sanitizeMongoQuery(item));
            }

            const sanitized: any = {};
            for (const key in value) {
                // Remove keys starting with $ (MongoDB operators)
                if (!key.startsWith('$')) {
                    sanitized[key] = this.sanitizeMongoQuery(value[key]);
                }
            }
            return sanitized;
        }

        return value;
    }

    /**
     * Sanitize HTML to prevent XSS
     */
    sanitizeHtml(value: string): string {
        if (typeof value !== 'string') return value;

        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Sanitize filename to prevent directory traversal
     */
    sanitizeFilename(filename: string): string {
        if (typeof filename !== 'string') return '';

        // Remove path traversal patterns
        let sanitized = filename.replace(/\.\./g, '');
        sanitized = sanitized.replace(/[\/\\]/g, '');

        // Remove special characters
        sanitized = sanitized.replace(/[<>:"|?*\x00-\x1F]/g, '');

        // Limit length
        if (sanitized.length > 255) {
            const ext = sanitized.split('.').pop();
            sanitized = sanitized.substring(0, 250) + '.' + ext;
        }

        return sanitized;
    }

    /**
     * Escape regex special characters
     */
    escapeRegex(value: string): string {
        if (typeof value !== 'string') return value;
        return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Validate and sanitize email
     */
    sanitizeEmail(email: string): string {
        if (typeof email !== 'string') return '';

        // Convert to lowercase and trim
        const sanitized = email.toLowerCase().trim();

        // Basic email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(sanitized)) {
            throw new Error('Invalid email format');
        }

        return sanitized;
    }

    /**
     * Check if email is from a disposable email provider
     */
    isDisposableEmail(email: string): boolean {
        const disposableDomains = [
            'tempmail.com',
            'throwaway.email',
            '10minutemail.com',
            'guerrillamail.com',
            'mailinator.com',
            'maildrop.cc',
            'temp-mail.org',
            'fakeinbox.com',
        ];

        const domain = email.split('@')[1]?.toLowerCase();
        return disposableDomains.includes(domain);
    }

    /**
     * Sanitize phone number
     */
    sanitizePhoneNumber(phone: string): string {
        if (typeof phone !== 'string') return '';

        // Remove all non-digit characters except +
        return phone.replace(/[^\d+]/g, '');
    }

    /**
     * Sanitize object recursively
     */
    sanitizeObject(obj: any): any {
        if (typeof obj !== 'object' || obj === null) {
            if (typeof obj === 'string') {
                return this.sanitizeHtml(obj);
            }
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        const sanitized: any = {};
        for (const key in obj) {
            sanitized[key] = this.sanitizeObject(obj[key]);
        }
        return sanitized;
    }
}
