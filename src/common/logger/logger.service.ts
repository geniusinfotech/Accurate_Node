/* eslint-disable prettier/prettier */
import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable()
export class CustomLogger implements LoggerService {
    private logger: winston.Logger;

    constructor() {
        const isDevelopment = process.env.NODE_ENV !== 'production';

        // Create transports
        const transports: winston.transport[] = [
            // Console transport
            new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.colorize(),
                    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                    winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
                        let log = `${timestamp} [${context || 'Application'}] ${level}: ${message}`;
                        if (Object.keys(meta).length > 0) {
                            log += ` ${JSON.stringify(meta)}`;
                        }
                        return log;
                    }),
                ),
            }),
        ];

        // Add file rotation in production
        if (!isDevelopment) {
            transports.push(
                new DailyRotateFile({
                    dirname: 'logs',
                    filename: 'application-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '14d',
                    level: 'info',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
                new DailyRotateFile({
                    dirname: 'logs',
                    filename: 'error-%DATE%.log',
                    datePattern: 'YYYY-MM-DD',
                    zippedArchive: true,
                    maxSize: '20m',
                    maxFiles: '30d',
                    level: 'error',
                    format: winston.format.combine(
                        winston.format.timestamp(),
                        winston.format.json(),
                    ),
                }),
            );
        }

        this.logger = winston.createLogger({
            level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
            transports,
        });
    }

    /**
     * Sanitize sensitive data from logs
     */
    private sanitize(data: any): any {
        if (typeof data !== 'object' || data === null) {
            return data;
        }

        const sensitiveKeys = [
            'password',
            'token',
            'secret',
            'authorization',
            'cookie',
            'jwt',
            'apiKey',
            'api_key',
            'accessToken',
            'refreshToken',
            'resetPasswordToken',
        ];

        const sanitized = Array.isArray(data) ? [...data] : { ...data };

        for (const key in sanitized) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof sanitized[key] === 'object') {
                sanitized[key] = this.sanitize(sanitized[key]);
            }
        }

        return sanitized;
    }

    log(message: string, context?: string) {
        this.logger.info(message, { context });
    }

    error(message: string, trace?: string, context?: string) {
        this.logger.error(message, { context, trace });
    }

    warn(message: string, context?: string) {
        this.logger.warn(message, { context });
    }

    debug(message: string, context?: string) {
        if (process.env.NODE_ENV !== 'production') {
            this.logger.debug(message, { context });
        }
    }

    verbose(message: string, context?: string) {
        if (process.env.NODE_ENV !== 'production') {
            this.logger.verbose(message, { context });
        }
    }

    /**
     * Log with automatic sanitization
     */
    logWithData(message: string, data: any, context?: string) {
        const sanitizedData = this.sanitize(data);
        this.logger.info(message, { context, data: sanitizedData });
    }

    /**
     * Log security events
     */
    logSecurityEvent(event: string, details: any, context?: string) {
        const sanitizedDetails = this.sanitize(details);
        this.logger.warn(`SECURITY: ${event}`, {
            context: context || 'Security',
            ...sanitizedDetails,
        });
    }
}
