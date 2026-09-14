/* eslint-disable prettier/prettier */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { APISuccess } from '../api-response';
import { Response } from 'express';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TransformInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();

    return next.handle().pipe(
      map((data) => {
        // If already APISuccess instance or has response/responseMessage, return formatted JSON
        if (data instanceof APISuccess) {
          return data.toJson();
        }
        if (data && typeof data === 'object' && ('response' in data || 'responseMessage' in data) && 'body' in data) {
          return data;
        }

        // Get the actual HTTP status code from the response
        const statusCode = response.statusCode || 200;

        // Determine appropriate message based on status code
        let message = 'Success';
        if (statusCode === 201) {
          message = 'Resource created successfully';
        } else if (statusCode === 204) {
          message = 'No content';
        } else if (statusCode === 202) {
          message = 'Request accepted';
        }

        // Handle different data types
        let responseData: any;

        if (data === null || data === undefined) {
          responseData = {};
        } else if (Array.isArray(data)) {
          // If it's an array, wrap it in an object
          responseData = { items: data, count: data.length };
        } else if (typeof data === 'object') {
          responseData = data;
        } else {
          // For primitives (string, number, boolean)
          responseData = { value: data };
        }

        const success = new APISuccess(statusCode, message, responseData);
        return success.toJson();
      }),
    );
  }
}