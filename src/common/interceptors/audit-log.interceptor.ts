import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ActivityLogService } from '../../activity-log/activity-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly activityLogService: ActivityLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user, body } = request;

    // Only intercept mutating HTTP methods
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Identify target modules based on URL path
    const isTargetModule =
      url.includes('/manufacturing') ||
      url.includes('/dealers') ||
      url.includes('/products') ||
      url.includes('/sales') ||
      url.includes('/orders');

    if (!isTargetModule || !user) {
      return next.handle();
    }

    // Determine action type
    let action: 'create' | 'update' | 'delete' | 'mark_done' = 'update';
    if (method === 'POST') {
      action = 'create';
    } else if (method === 'DELETE') {
      action = 'delete';
    } else if (method === 'PATCH' || method === 'PUT') {
      if (url.includes('/complete') || url.includes('/mark-done')) {
        action = 'mark_done';
      } else {
        action = 'update';
      }
    }

    // Extract entityType from route prefix
    let entityType = 'unknown';
    if (url.includes('/raw-materials')) entityType = 'RawMaterial';
    else if (url.includes('/work-batches')) entityType = 'WorkBatch';
    else if (url.includes('/worker-payments')) entityType = 'WorkerPayment';
    else if (url.includes('/semi-finished-stock'))
      entityType = 'SemiFinishedStock';
    else if (url.includes('/dealers')) entityType = 'Dealer';
    else if (url.includes('/products')) entityType = 'Product';
    else if (url.includes('/sales')) entityType = 'Sale';
    else if (url.includes('/orders')) entityType = 'Order';

    const actorId = user._id || user.userId || user.sub;
    const actorName =
      `${user.firstname || ''} ${user.lastname || ''}`.trim() ||
      user.username ||
      user.email ||
      'Unknown User';

    return next.handle().pipe(
      tap(async (responseData) => {
        try {
          const entityId =
            request.params?.id ||
            responseData?._id?.toString() ||
            responseData?.id?.toString() ||
            'N/A';

          // Determine actor role from user's roles array
          const actorRole = user.roles?.includes('admin')
            ? 'admin'
            : user.roles?.includes('manager')
              ? 'manager'
              : 'user';

          const sanitize = (obj: any) => {
            if (!obj || typeof obj !== 'object') return obj;
            const clone = Array.isArray(obj) ? [...obj] : { ...obj };
            const redactKeys = [
              'password',
              'token',
              'secret',
              'authorization',
              'cookie',
              'jwt',
              'refreshToken',
              'accessToken',
              'paymentId',
              'resetPasswordToken',
            ];
            for (const k of Object.keys(clone)) {
              if (
                redactKeys.some((rk) =>
                  k.toLowerCase().includes(rk.toLowerCase()),
                )
              )
                clone[k] = '[REDACTED]';
              else if (typeof clone[k] === 'object')
                clone[k] = sanitize(clone[k]);
            }
            return clone;
          };
          const before =
            method === 'PATCH' || method === 'PUT' ? sanitize(body) : undefined;
          const after =
            responseData && typeof responseData === 'object'
              ? sanitize(responseData)
              : undefined;

          const changes = this.buildChanges(before, after);
          const summary = this.buildSummary(
            action,
            entityType,
            entityId,
            after,
          );

          const logPayload: any = {
            actorId,
            actorName,
            actorRole,
            action,
            entityType,
            entityId,
            before,
            after,
            summary,
          };
          if (changes.length > 0) {
            logPayload.changes = changes;
          }

          await this.activityLogService.createLog(logPayload);
        } catch (err) {
          // Log silently to avoid breaking primary requests
          console.error('AuditLogInterceptor failed to log activity:', err);
        }
      }),
    );
  }

  private buildChanges(
    before: any,
    after: any,
  ): Array<{ field: string; from: any; to: any }> {
    if (
      !before ||
      !after ||
      typeof before !== 'object' ||
      typeof after !== 'object'
    ) {
      return [];
    }

    const excludedFields = new Set([
      '_id',
      '__v',
      'id',
      'createdAt',
      'updatedAt',
    ]);
    const changes: Array<{ field: string; from: any; to: any }> = [];

    for (const field of Object.keys(before)) {
      if (excludedFields.has(field) || !(field in after)) continue;

      const fromValue = before[field];
      const toValue = after[field];
      const isComplex = (value: any) =>
        value !== null && typeof value === 'object';
      const fromSnapshot = isComplex(fromValue)
        ? JSON.stringify(fromValue)
        : fromValue;
      const toSnapshot = isComplex(toValue) ? JSON.stringify(toValue) : toValue;

      if (fromSnapshot !== toSnapshot) {
        changes.push({ field, from: fromSnapshot, to: toSnapshot });
      }
    }

    return changes;
  }

  private buildSummary(
    action: string,
    entityType: string,
    entityId: string,
    after: any,
  ): string {
    if (
      action === 'create' &&
      entityType === 'Sale' &&
      after &&
      typeof after === 'object'
    ) {
      const saleNumber = after.saleNumber || '';
      const customerName = after.customerName || '';
      const totalAmount = after.totalAmount ?? '';
      return `Created Sale ${saleNumber} for ${customerName} ₹${totalAmount}`.trim();
    }
    return `${action} ${entityType} ${entityId}`;
  }
}
