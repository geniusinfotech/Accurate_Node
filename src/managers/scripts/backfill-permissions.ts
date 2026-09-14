/* eslint-disable prettier/prettier */
import 'dotenv/config';
import mongoose from 'mongoose';

const ALL_PERMISSIONS = [
  'dashboard:view',

  'inventory:view',
  'inventory:add',
  'inventory:edit',
  'inventory:delete',

  'raw_materials:view',
  'raw_materials:add',
  'raw_materials:edit',
  'raw_materials:delete',

  'dealers:view',
  'dealers:add',
  'dealers:edit',
  'dealers:delete',
  'dealers:ledger',

  'sell:view',
  'sell:create',
  'sell:print',
  'sell:delete',

  'workers:view',
  'workers:add',
  'workers:edit',
  'workers:delete',
  'workers:assign',
  'workers:mark_done',
  'workers:payments',

  'accounts:view',
  'accounts:record',

  'activity_log:view',

  'orders:view',
  'orders:update',
  'orders:print',

  'products:view',
  'products:add',
  'products:edit',
  'products:delete',

  'categories:view',
  'categories:add',
  'categories:edit',
  'categories:delete',

  'banners:view',
  'banners:add',
  'banners:edit',
  'banners:delete',

  'offers:view',
  'offers:add',
  'offers:edit',
  'offers:toggle',
  'offers:delete',

  'coupons:view',
  'coupons:add',

  'shipping:view',
  'shipping:edit',

  'testimonials:view',
  'testimonials:add',
  'testimonials:edit',
  'testimonials:toggle',
  'testimonials:delete',
];

const DEPRECATED_PERMISSIONS = [
  'view_stock',
  'assign_work',
  'mark_done',
  'manage_workers',
  'manage_dealers',
  'view_payments',
  'record_payments',
  'publish_product',
  'manage_prices',
  'view_activity_log',
  'manage_categories',
  'manage_banners',
  'manage_orders',
  'manage_offers',
  'manage_coupons',
  'manage_shipping',
  'manage_testimonials',
  'view_dashboard',
];

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const managerModel = mongoose.model(
    'Manager',
    new mongoose.Schema({}, { strict: false }),
  );

  const managers = await managerModel.find({}).exec();
  let updated = 0;

  for (const manager of managers) {
    const stored = ((manager as any).permissions || []) as string[];
    const cleaned = stored.filter((p) => !DEPRECATED_PERMISSIONS.includes(p));
    const merged = [...new Set([...cleaned, ...ALL_PERMISSIONS])].sort();
    if (JSON.stringify(merged) === JSON.stringify([...stored].sort())) continue;
    await managerModel.updateOne(
      { _id: manager._id },
      { $set: { permissions: merged } },
    );
    updated += 1;
  }

  console.log(
    `Migrated permissions for ${updated}/${managers.length} manager(s) to the new section-based model`,
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});