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
            before,
            changes,
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
      'password',
      'refreshToken',
      'accessToken',
      'resetPasswordToken',
      'token',
      'secret',
    ]);
    const changes: Array<{ field: string; from: any; to: any }> = [];

    // Compare request payload (before) against saved record (after) so the
    // summary reads "Price 100 → 120" instead of dumping two JSON blobs.
    const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const field of fields) {
      if (excludedFields.has(field)) continue;
      // Skip server-managed bookkeeping that reads as noise.
      if (/^(createdAt|updatedAt|__v)$/.test(field)) continue;

      const fromValue = before[field];
      const toValue = after[field];
      const isComplex = (value: any) =>
        value !== null && typeof value === 'object';
      const fromSnapshot = isComplex(fromValue)
        ? JSON.stringify(fromValue)
        : fromValue;
      const toSnapshot = isComplex(toValue) ? JSON.stringify(toValue) : toValue;

      if (fromSnapshot !== toSnapshot) {
        // New fields (create) show as "empty → value"; removed as "value → empty".
        changes.push({ field, from: fromSnapshot, to: toSnapshot });
        if (changes.length >= 20) break; // keep the log readable
      }
    }

    return changes;
  }

  private buildSummary(
    action: string,
    entityType: string,
    entityId: string,
    after: any,
    before?: any,
    changes?: Array<{ field: string; from: any; to: any }>,
  ): string {
    const entityLabel = this.humanizeEntity(entityType);
    const name = this.pickDisplayName(after || before);
    const quotedName = name ? ` "${this.shorten(name, 60)}"` : '';
    const verb =
      action === 'create'
        ? 'Created'
        : action === 'delete'
          ? 'Deleted'
          : action === 'mark_done'
            ? 'Completed'
            : 'Updated';

    // Sale keeps its rich legacy format.
    if (
      action === 'create' &&
      entityType === 'Sale' &&
      after &&
      typeof after === 'object'
    ) {
      const saleNumber = after.saleNumber || '';
      const customerName = after.customerName || 'a customer';
      const total =
        after.totalAmount ?? after.total ?? after.grandTotal ?? '';
      const money = total !== '' ? ` for ${this.formatMoney(total)}` : '';
      return `Created Sale${saleNumber ? ` ${saleNumber}` : ''} for ${customerName}${money}`.trim();
    }

    // Order create/update with order number + status context.
    if (entityType === 'Order' && after && typeof after === 'object') {
      const orderNo = after.orderNumber ? ` #${after.orderNumber}` : quotedName;
      if (action === 'create') {
        const total = after.total ?? after.grandTotal ?? '';
        return `Created Order${orderNo}${total !== '' ? ` worth ${this.formatMoney(total)}` : ''}`.trim();
      }
      if (action === 'update' && changes?.length) {
        return `Updated Order${orderNo}: ${this.summarizeChanges(changes)}`;
      }
      return `${verb} Order${orderNo}`.trim();
    }

    // Generic update: list up to 3 changed fields in plain language.
    if (action === 'update' && changes?.length) {
      return `${verb} ${entityLabel}${quotedName}: ${this.summarizeChanges(changes)}`;
    }

    // Generic create/delete/mark_done with a money hint where relevant.
    if ((action === 'create' || action === 'delete') && after && typeof after === 'object') {
      const moneyHint = this.pickMoneyHint(after);
      return `${verb} ${entityLabel}${quotedName}${moneyHint}`.trim();
    }
    if (action === 'mark_done') {
      return `${verb} ${entityLabel}${quotedName}`.trim();
    }

    // Fallback — never expose a raw ObjectId as the headline when we have a name.
    if (name) return `${verb} ${entityLabel}${quotedName}`;
    return `${verb} ${entityLabel} ${entityId}`;
  }

  private humanizeEntity(entityType: string): string {
    const map: Record<string, string> = {
      RawMaterial: 'Raw Material',
      WorkBatch: 'Work Batch',
      WorkerPayment: 'Worker Payment',
      SemiFinishedStock: 'Semi-Finished Stock',
      Sale: 'Sale',
      Order: 'Order',
      Product: 'Product',
      Dealer: 'Dealer',
    };
    if (map[entityType]) return map[entityType];
    return entityType
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private pickDisplayName(obj: any): string {
    if (!obj || typeof obj !== 'object') return '';
    const candidates = [
      obj.name,
      obj.title,
      obj.customerName,
      obj.dealerName,
      obj.workerName,
      obj.orderNumber && `Order #${obj.orderNumber}`,
      obj.saleNumber && `Sale ${obj.saleNumber}`,
      obj.code,
      obj.sku,
      obj.email,
      obj.phone,
      obj.lotId,
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    return '';
  }

  private pickMoneyHint(after: any): string {
    const amount =
      after.totalAmount ?? after.total ?? after.grandTotal ?? after.price ?? after.amount;
    if (amount === undefined || amount === null || amount === '') return '';
    if (typeof amount === 'number') return ` (${this.formatMoney(amount)})`;
    return '';
  }

  private summarizeChanges(
    changes: Array<{ field: string; from: any; to: any }>,
  ): string {
    const shown = changes.slice(0, 3).map((c) => {
      const label = this.humanizeField(c.field);
      return `${label} ${this.formatShort(c.from)} → ${this.formatShort(c.to)}`;
    });
    const extra = changes.length > 3 ? ` (+${changes.length - 3} more)` : '';
    return shown.join(', ') + extra;
  }

  private humanizeField(field: string): string {
    return field
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (ch) => ch.toUpperCase());
  }

  private formatShort(value: any): string {
    if (value === null || value === undefined || value === '') return 'empty';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') return String(value);
    const str = String(value);
    return str.length > 40 ? `${str.slice(0, 40)}…` : str;
  }

  private formatMoney(value: any): string {
    if (typeof value === 'number') {
      return `₹${value.toLocaleString('en-IN')}`;
    }
    return `₹${value}`;
  }

  private shorten(value: string, max: number): string {
    return value.length > max ? `${value.slice(0, max)}…` : value;
  }
}
