/* eslint-disable prettier/prettier */
import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Standard API Error Response
 * Used for all error responses across the application
 * Structure: { statusCode, response, body }
 */
export class APIError extends HttpException {
  statusCode: number;
  responseMessage: string;
  stack?: string;
  body: Record<string, any>;

  constructor(
    statusCode: number,
    responseMessage: string,
    stack?: string,
    body: Record<string, any> = {},
  ) {
    super(responseMessage, statusCode);
    this.statusCode = statusCode;
    this.responseMessage = responseMessage;
    this.stack = stack;
    this.body = body || {};
  }

  toJson() {
    const responseObj: any = {
      statusCode: this.statusCode,
      response: this.responseMessage,
      body: this.body,
    };

    // Only include stack trace in development
    if (process.env.NODE_ENV !== 'production' && this.stack) {
      responseObj.body.stack = this.stack;
    }

    return responseObj;
  }

  // Factory methods for common errors
  static badRequest(responseMessage: string = 'Bad Request', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.BAD_REQUEST, responseMessage, undefined, body);
  }

  static unauthorized(responseMessage: string = 'Unauthorized', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.UNAUTHORIZED, responseMessage, undefined, body);
  }

  static forbidden(responseMessage: string = 'Forbidden', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.FORBIDDEN, responseMessage, undefined, body);
  }

  static notFound(responseMessage: string = 'Resource not found', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.NOT_FOUND, responseMessage, undefined, body);
  }

  static conflict(responseMessage: string = 'Conflict', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.CONFLICT, responseMessage, undefined, body);
  }

  static internalServerError(responseMessage: string = 'Internal Server Error', body: Record<string, any> = {}) {
    return new APIError(HttpStatus.INTERNAL_SERVER_ERROR, responseMessage, undefined, body);
  }

  static validationError(errors: any[], responseMessage: string = 'Validation failed') {
    return new APIError(HttpStatus.BAD_REQUEST, responseMessage, undefined, { errors });
  }
}

/**
 * Standard API Success Response
 * Used for all successful responses across the application
 * Structure: { statusCode, response, body }
 */
export class APISuccess {
  statusCode: number;
  responseMessage: string;
  body: Record<string, any> | any[];

  constructor(statusCode: number, responseMessage: string, body: Record<string, any> | any[] = {}) {
    this.statusCode = statusCode;
    this.responseMessage = responseMessage;
    this.body = body || {};
  }

  toJson() {
    return {
      statusCode: this.statusCode,
      response: this.responseMessage,
      body: this.body,
    };
  }

  // Factory methods for common success responses
  static ok(body: any = {}, responseMessage: string = 'Success') {
    return new APISuccess(HttpStatus.OK, responseMessage, body);
  }

  static created(body: any = {}, responseMessage: string = 'Resource created successfully') {
    return new APISuccess(HttpStatus.CREATED, responseMessage, body);
  }

  static accepted(body: any = {}, responseMessage: string = 'Request accepted') {
    return new APISuccess(HttpStatus.ACCEPTED, responseMessage, body);
  }

  static noContent(responseMessage: string = 'No content') {
    return new APISuccess(HttpStatus.NO_CONTENT, responseMessage, {});
  }
}

/**
 * Helper function to create paginated response
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export class APIPaginatedSuccess extends APISuccess {
  constructor(
    data: any[],
    meta: PaginationMeta,
    responseMessage: string = 'Success',
  ) {
    super(HttpStatus.OK, responseMessage, { items: data, meta });
  }

  static create(
    items: any[],
    page: number,
    limit: number,
    total: number,
    responseMessage: string = 'Success',
  ) {
    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
    return new APIPaginatedSuccess(items, meta, responseMessage);
  }
}

export default {
  APIError,
  APISuccess,
  APIPaginatedSuccess,
};

