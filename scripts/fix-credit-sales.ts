import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment variables');
  process.exit(1);
}

/**
 * Fix corrupted credit sales:
 * Bug: paymentMode='credit' sales were saved with amountPaid=billAmount (fully paid) and balanceDue=0
 *      due to frontend `amountPaid >0 ? amountPaid : totalAmount` and backend `amountPaid ?? billAmount`.
 * Correct: credit default 0 (fully due), allow partial 0..billAmount, balanceDue = billAmount - amountPaid
 *
 * This script:
 * 1. Finds Sale docs with paymentMode='credit' where amountPaid === totalAmount and balanceDue === 0
 *    (heuristically corrupted fully-paid credit sales). Fixes to amountPaid=0, balanceDue=totalAmount.
 * 2. For those sales, removes the spurious CustomerLedger payment entry (type='payment', notes='Paid on sale', refSaleId=saleId)
 *    so ledger summary correctly shows due.
 * 3. Also fixes any credit sales where balanceDue mismatches totalAmount - amountPaid.
 *
 * Run: npx ts-node scripts/fix-credit-sales.ts
 * Dry-run: DRY_RUN=true npx ts-node scripts/fix-credit-sales.ts
 */

const DRY_RUN = process.env.DRY_RUN === 'true' || process.argv.includes('--dry-run');

async function fixCreditSales() {
  console.log(`Connecting to MongoDB... ${DRY_RUN ? '(DRY RUN)' : ''}`);
  await mongoose.connect(MONGODB_URI as string);
  console.log('Connected.');

  const db = mongoose.connection.db;
  if (!db) throw new Error('DB connection failed');

  const salesCol = db.collection('sales');
  const ledgerCol = db.collection('customerledgers');

  // 1. Find all credit sales
  const creditSales = await salesCol.find({ paymentMode: 'credit' }).toArray();
  console.log(`Found ${creditSales.length} credit sales total.`);

  let corruptedFullPaid = 0;
  let mismatched = 0;
  const saleIdsToCleanLedger: string[] = [];

  for (const sale of creditSales) {
    const totalAmount = Number(sale.totalAmount) || 0;
    const amountPaid = Number(sale.amountPaid) || 0;
    const balanceDue = Number(sale.balanceDue) || 0;
    const expectedDue = Math.max(0, totalAmount - amountPaid);

    // Heuristic: fully paid credit where due=0 but should be due = total
    // This is the main bug: amountPaid == totalAmount and balanceDue ==0
    const isCorruptedFullPaid = totalAmount > 0 && amountPaid === totalAmount && balanceDue === 0;
    // Also catch mismatch where stored balanceDue != expectedDue
    const isMismatched = balanceDue !== expectedDue;

    if (isCorruptedFullPaid) {
      corruptedFullPaid++;
      saleIdsToCleanLedger.push(String(sale._id));
      console.log(`Corrupted FULL-PAID credit sale ${sale.saleNumber} (${sale._id}): total=${totalAmount} paid=${amountPaid} due=${balanceDue} -> fixing to paid=0 due=${totalAmount}`);
      if (!DRY_RUN) {
        await salesCol.updateOne(
          { _id: sale._id },
          { $set: { amountPaid: 0, balanceDue: totalAmount } }
        );
      }
    } else if (isMismatched) {
      mismatched++;
      console.log(`Mismatched credit sale ${sale.saleNumber} (${sale._id}): total=${totalAmount} paid=${amountPaid} due=${balanceDue} expectedDue=${expectedDue} -> fixing`);
      if (!DRY_RUN) {
        await salesCol.updateOne(
          { _id: sale._id },
          { $set: { balanceDue: expectedDue } }
        );
      }
    }
  }

  console.log(`\nCorrupted full-paid credit sales: ${corruptedFullPaid}`);
  console.log(`Mismatched due sales: ${mismatched}`);

  // 2. Clean ledger payment entries for corrupted sales
  if (saleIdsToCleanLedger.length > 0) {
    const objectIds = saleIdsToCleanLedger.map((id) => new mongoose.Types.ObjectId(id));
    const ledgerPayments = await ledgerCol
      .find({
        refSaleId: { $in: objectIds },
        type: 'payment',
        notes: 'Paid on sale',
      })
      .toArray();
    console.log(`Found ${ledgerPayments.length} spurious ledger payment entries to delete for corrupted sales.`);
    if (ledgerPayments.length > 0) {
      console.table(
        ledgerPayments.map((l: any) => ({
          _id: String(l._id),
          refSaleId: String(l.refSaleId),
          amount: l.amount,
          customerName: l.customerName,
        }))
      );
      if (!DRY_RUN) {
        const res = await ledgerCol.deleteMany({
          refSaleId: { $in: objectIds },
          type: 'payment',
          notes: 'Paid on sale',
        });
        console.log(`Deleted ${res.deletedCount} ledger payment entries.`);
      } else {
        console.log('DRY RUN: would delete those entries.');
      }
    }

    // Verify remaining ledger entries still have sale entry
    for (const id of objectIds) {
      const saleEntry = await ledgerCol.findOne({ refSaleId: new mongoose.Types.ObjectId(id), type: 'sale' });
      if (!saleEntry) {
        console.warn(`WARNING: Sale ${id} has no ledger sale entry – may need manual recreation`);
        // Optionally recreate sale entry if missing:
        // const sale = await salesCol.findOne({_id: new mongoose.Types.ObjectId(id)});
        // if (sale && !DRY_RUN) await ledgerCol.insertOne({ customerName: sale.customerName, phone: sale.phone, type:'sale', amount: sale.totalAmount, refSaleId: sale._id, date: sale.saleDate, mode: sale.paymentMode })
      }
    }
  }

  // 3. General mismatch fix for ALL sales (not just credit) where balanceDue drift
  const allSales = await salesCol.find({}).toArray();
  let generalMismatched = 0;
  for (const sale of allSales) {
    const total = Number(sale.totalAmount) || 0;
    const paid = Number(sale.amountPaid) || 0;
    const due = Number(sale.balanceDue) || 0;
    const expected = Math.max(0, total - paid);
    if (due !== expected) {
      // Skip already handled credit ones to avoid double count
      if (sale.paymentMode === 'credit' && (due === 0 && paid === total && total > 0)) continue;
      if (sale.paymentMode === 'credit' && due !== expected && saleIdsToCleanLedger.includes(String(sale._id))) continue;
      generalMismatched++;
      if (!DRY_RUN) {
        await salesCol.updateOne({ _id: sale._id }, { $set: { balanceDue: expected } });
      }
    }
  }
  if (generalMismatched > 0) {
    console.log(`\nFixed ${generalMismatched} general sale(s) with mismatched balanceDue (non-credit or already not counted).`);
  }

  console.log(`\nDone ${DRY_RUN ? '(DRY RUN – no changes written)' : ''}. Please verify:`);
  console.log(` - db.sales.find({paymentMode:'credit'}) – amountPaid should be 0 for full credit`);
  console.log(` - db.customerledgers.aggregate([{$group:{_id:{c:'$customerName',p:'$phone'}, sales:{$sum:{$cond:[{$eq:['$type','sale']},'$amount',0]}}, paid:{$sum:{$cond:[{$eq:['$type','payment']},'$amount',0]}}}}])`);

  await mongoose.disconnect();
}

fixCreditSales().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
