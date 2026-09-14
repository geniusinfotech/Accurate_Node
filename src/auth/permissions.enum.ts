export enum Permission {
  DASHBOARD_VIEW = 'dashboard:view',

  INVENTORY_VIEW = 'inventory:view',
  INVENTORY_ADD = 'inventory:add',
  INVENTORY_EDIT = 'inventory:edit',
  INVENTORY_DELETE = 'inventory:delete',

  RAW_MATERIALS_VIEW = 'raw_materials:view',
  RAW_MATERIALS_ADD = 'raw_materials:add',
  RAW_MATERIALS_EDIT = 'raw_materials:edit',
  RAW_MATERIALS_DELETE = 'raw_materials:delete',

  DEALERS_VIEW = 'dealers:view',
  DEALERS_ADD = 'dealers:add',
  DEALERS_EDIT = 'dealers:edit',
  DEALERS_DELETE = 'dealers:delete',
  DEALERS_LEDGER = 'dealers:ledger',

  SELL_VIEW = 'sell:view',
  SELL_CREATE = 'sell:create',
  SELL_EDIT = 'sell:edit',
  SELL_PRINT = 'sell:print',
  SELL_DELETE = 'sell:delete',

  CUSTOMERS_VIEW = 'customers:view',
  CUSTOMERS_ADD = 'customers:add',
  CUSTOMERS_EDIT = 'customers:edit',
  CUSTOMERS_DELETE = 'customers:delete',

  WORKERS_VIEW = 'workers:view',
  WORKERS_ADD = 'workers:add',
  WORKERS_EDIT = 'workers:edit',
  WORKERS_DELETE = 'workers:delete',
  WORKERS_ASSIGN = 'workers:assign',
  WORKERS_MARK_DONE = 'workers:mark_done',
  WORKERS_PAYMENTS = 'workers:payments',

  ACCOUNTS_VIEW = 'accounts:view',
  ACCOUNTS_RECORD = 'accounts:record',

  ACTIVITY_LOG_VIEW = 'activity_log:view',

  ORDERS_VIEW = 'orders:view',
  ORDERS_UPDATE = 'orders:update',
  ORDERS_PRINT = 'orders:print',

  REPORTS_VIEW = 'reports:view',

  PRODUCTS_VIEW = 'products:view',
  PRODUCTS_ADD = 'products:add',
  PRODUCTS_EDIT = 'products:edit',
  PRODUCTS_DELETE = 'products:delete',

  CATEGORIES_VIEW = 'categories:view',
  CATEGORIES_ADD = 'categories:add',
  CATEGORIES_EDIT = 'categories:edit',
  CATEGORIES_DELETE = 'categories:delete',

  BANNERS_VIEW = 'banners:view',
  BANNERS_ADD = 'banners:add',
  BANNERS_EDIT = 'banners:edit',
  BANNERS_DELETE = 'banners:delete',

  OFFERS_VIEW = 'offers:view',
  OFFERS_ADD = 'offers:add',
  OFFERS_EDIT = 'offers:edit',
  OFFERS_TOGGLE = 'offers:toggle',
  OFFERS_DELETE = 'offers:delete',

  COUPONS_VIEW = 'coupons:view',
  COUPONS_ADD = 'coupons:add',
  COUPONS_EDIT = 'coupons:edit',
  COUPONS_DELETE = 'coupons:delete',

  SHIPPING_VIEW = 'shipping:view',
  SHIPPING_EDIT = 'shipping:edit',

  TESTIMONIALS_VIEW = 'testimonials:view',
  TESTIMONIALS_ADD = 'testimonials:add',
  TESTIMONIALS_EDIT = 'testimonials:edit',
  TESTIMONIALS_TOGGLE = 'testimonials:toggle',
  TESTIMONIALS_DELETE = 'testimonials:delete',
}
