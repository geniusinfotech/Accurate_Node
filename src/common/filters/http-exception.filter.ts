/* eslint-disable prettier/prettier */
import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { APIError } from '../api-response';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(HttpExceptionFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let apiError: APIError;

        // Handle custom APIError
        if (exception instanceof APIError) {
            apiError = exception;
        }
        // Handle NestJS HttpException (including validation errors)
        else if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            // Handle validation errors from class-validator
            if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
                const messages = (exceptionResponse as any).message;

                // If it's a validation error with array of messages
                if (Array.isArray(messages)) {
                    apiError = APIError.validationError(
                        messages.map((msg: string) => ({ message: msg })),
                        'Validation failed'
                    );
                } else {
                    const message = messages || (exceptionResponse as any).error || exception.message;
                    apiError = new APIError(status, message, exception.stack, {
                        response: exceptionResponse,
                    });
                }
            } else {
                const message = typeof exceptionResponse === 'string'
                    ? exceptionResponse
                    : exception.message;
                apiError = new APIError(status, message, exception.stack);
            }
        }
        // Handle MongoDB errors
        else if ((exception as any).name === 'MongoError' || (exception as any).name === 'MongoServerError') {
            const mongoError = exception as any;

            // Duplicate key error — do not echo attacker-controlled value
            if (mongoError.code === 11000) {
                const field = Object.keys(mongoError.keyPattern || {})[0] || 'field';
                apiError = APIError.conflict(
                    `Duplicate value for ${field}`,
                    { field }
                );
            } else {
                apiError = APIError.internalServerError('Database error', {
                    code: mongoError.code,
                });
            }
        }
        // Handle Mongoose validation errors
        else if ((exception as any).name === 'ValidationError') {
            const validationError = exception as any;
            const errors = Object.values(validationError.errors || {}).map((err: any) => ({
                field: err.path,
                message: err.message,
            }));
            apiError = APIError.validationError(errors, 'Validation failed');
        }
        // Handle Mongoose CastError (invalid ObjectId, etc.) — redact value
        else if ((exception as any).name === 'CastError') {
            const castError = exception as any;
            apiError = APIError.badRequest(
                `Invalid ${castError.path}`,
                { path: castError.path }
            );
        }
        // Handle all other errors
        else {
            const errorMessage = (exception as any)?.message || 'Internal server error';
            apiError = new APIError(
                HttpStatus.INTERNAL_SERVER_ERROR,
                errorMessage,
                (exception as any)?.stack,
                { originalError: process.env.NODE_ENV !== 'production' ? exception : undefined },
            );
        }

        // Log the error for debugging
        const errorLog = {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            statusCode: apiError.statusCode,
            response: apiError.responseMessage,
            ...(process.env.NODE_ENV !== 'production' && { stack: apiError.stack }),
        };

        if (apiError.statusCode >= 500) {
            this.logger.error('Server Error:', JSON.stringify(errorLog, null, 2));
        } else if (apiError.statusCode >= 400) {
            this.logger.warn('Client Error:', JSON.stringify(errorLog, null, 2));
        }

        // Send the response
        const payload = apiError.toJson();
        response.status(apiError.statusCode).json(payload);
    }
}