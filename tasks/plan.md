# Backend Implementation Stages

Stack: Nest.js · MongoDB (Mongoose) · existing modules under `src/manufacturing/*`, `src/products/*`, `src/auth/*`

This plan builds on what already exists in the codebase (`raw-materials`, `work-batches`, `semi-finished-stock`, `worker-payments`, `products.sourceStockId` publish gate, `managers.permissions`, `ActivityInterceptor` pattern). Each stage is independently shippable.

---

## Stage B1 — Dealers Module

**Goal:** Replace free-text `dealerName` with a real dealer entity + running ledger.

**New module:** `src/dealers/`

```ts
// schemas/dealer.schema.ts
{ name, phone, address, notes, isActive }

// schemas/dealer-ledger.schema.ts
{ dealerId: ObjectId ref Dealer, type: 'purchase' | 'payment', amount, refPurchaseId?, date, mode, notes }
```

**Tasks:**
- [x] `DealersController` — CRUD endpoints
- [x] `GET /dealers/:id/ledger` — aggregate purchases vs payments, running balance (mirror `WorkerPaymentsService.getLedgerSummary` pattern)
- [x] Migrate `raw-materials.dealerName: string` → `dealerId: ObjectId ref Dealer` (write a migration script; keep old string field temporarily as fallback for existing records)
- [x] Auto-create a `dealerLedger` `'purchase'` entry whenever a `RawMaterial` is created with `totalAmount`
- [x] `DealersModule` exported from `AppModule`

**Depends on:** nothing (can start immediately)

---

## Stage B2 — Lot Traceability

**Goal:** A single `lotId` follows a raw material batch through every production stage to the final product.

**Tasks:**
- [x] Generate short `lotId` (e.g. `LOT-2026-0001`) on `RawMaterial.create()`
- [x] Add `lotId: string` (indexed) to: `RawMaterial`, `WorkBatch`, `SemiFinishedStock`, `Product` schemas
- [x] Propagate `lotId` automatically:
  - `WorkBatchesService.create()` — copy from `rawMaterialId` or `parentBatchId`
  - `SemiFinishedStockService.create()` — copy from `batchId`
  - `ProductsService.create()` — copy from `sourceStockId`
- [x] New endpoint: `GET /lots/:lotId/trace` — returns full chain (purchase → batch(es) → stock → product)

**Depends on:** B1 not required, but do after B1 for consistency

---

## Stage B3 — Wastage / Loss Tracking

**Goal:** Auto-compute and persist metal/material loss % on every "mark as done" action.

**Tasks:**
- [x] Add `lossPercent: number` field to `WorkBatch` schema
- [x] In `WorkBatchesService` mark-done path, compute server-side (never trust client value):
  ```ts
  lossPercent = ((kgGivenOut - returnedWeightEquivalent) / kgGivenOut) * 100
  ```
- [x] Add configurable `LOSS_ALERT_THRESHOLD_PCT` (env var)
- [x] Emit `work.highLoss` event via existing `EventEmitterModule` when threshold exceeded (mirror `InventoryService` low-stock event pattern)

**Depends on:** B4 (do together — same code path)

---

## Stage B4 — Partial Completions History

**Goal:** Support multiple partial returns against a single work batch instead of one-shot done/not-done.

**Tasks:**
- [x] Replace single `returnedQuantity/returnedPcs/returnedWeight` fields with:
  ```ts
  completions: [{ date, pcsReturned, weightReturned, defectCount, note, addedToStockId? }]
  ```
- [x] Add computed `remainingQty = kgGivenOut - sum(completions.pcsReturned/weightReturned)`
- [x] New endpoint: `PATCH /manufacturing/work-batches/:id/complete` (append a completion entry — separate from generic `update()`)
- [x] Update status transitions: `out` → `partial` (remaining > 0 after ≥1 completion) → `returned` (remaining ≈ 0)

**Depends on:** Ship together with B3 (same controller/service surface)

---

## Stage B5 — Granular Permission Matrix

**Goal:** Replace free-text permission strings with an enforced enum covering fine-grained actions.

**Tasks:**
- [x] New `src/auth/permissions.enum.ts`:
  ```ts
  export enum Permission {
    VIEW_STOCK = 'view_stock',
    ASSIGN_WORK = 'assign_work',
    MARK_DONE = 'mark_done',
    MANAGE_WORKERS = 'manage_workers',
    MANAGE_DEALERS = 'manage_dealers',
    VIEW_PAYMENTS = 'view_payments',
    RECORD_PAYMENTS = 'record_payments',
    PUBLISH_PRODUCT = 'publish_product',
    MANAGE_PRICES = 'manage_prices',
    VIEW_ACTIVITY_LOG = 'view_activity_log',
  }
  ```
- [x] Tighten `@Permissions()` decorator usage across `work-batches`, `raw-materials`, `products`, `worker-payments`, `dealers` controllers
- [x] Update `CreateManagerDto.permissions` → `@IsEnum(Permission, { each: true })`
- [x] `PermissionsGuard` logic stays the same (`manager.permissions.includes(permission)`)

**Depends on:** B1 (dealers permission), otherwise independent

---

## Stage B6 — Activity Log (Audit Trail)

**Goal:** Log who created/edited/marked-done what, across the manufacturing and catalog modules.

**New module:** `src/activity-log/`

```ts
{ actorId, actorName, action: 'create'|'update'|'delete'|'mark_done', entityType, entityId, before?, after?, timestamp }
```

**Tasks:**
- [x] Implement as a global interceptor (mirror existing `ActivityInterceptor` pattern) hooking into mutating routes (`POST`/`PATCH`/`DELETE`) on manufacturing/dealers/products controllers
- [x] `GET /activity-log?entityType=&entityId=&actorId=` — gated by `Permission.VIEW_ACTIVITY_LOG`

**Depends on:** B5 (uses the new permission enum for the view gate)

---

## Stage B7 — Dashboard Aggregation Endpoint

**Goal:** One endpoint powering the owner dashboard instead of the frontend fanning out multiple requests.

**Tasks:**
- [x] `GET /dashboard/summary` combining:
  - Pending work batches (`status: out | partial`)
  - Low raw-material stock
  - Total dues to workers (`worker-payments.getLedgerSummary`)
  - Total dues to dealers (new dealer ledger from B1)
  - This-month production count

**Depends on:** B1, B4 (needs dealer ledger + partial completion status)

---

## Suggested Execution Order

```
B1 (Dealers) → B2 (Lot trace) → B3 + B4 (Loss + partial completions, together)
→ B5 (Permissions) → B6 (Activity log) → B7 (Dashboard)
```