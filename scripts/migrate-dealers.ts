import * as dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment variables');
  process.exit(1);
}

async function migrateDealers() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI as string);
  console.log('Connected successfully.');

  const db = mongoose.connection.db;
  if (!db) {
    console.error('Database connection failed');
    process.exit(1);
  }

  const rawMaterialsCol = db.collection('rawmaterials');
  const dealersCol = db.collection('dealers');
  const dealerLedgersCol = db.collection('dealerledgers');

  const cursor = rawMaterialsCol.find({
    dealerName: { $exists: true, $ne: '' },
    dealerId: { $exists: false },
  });

  const materials = await cursor.toArray();
  console.log(`Found ${materials.length} raw materials needing dealer migration.`);

  for (const material of materials) {
    const dealerNameStr = material.dealerName.trim();
    if (!dealerNameStr) continue;

    // Find or create Dealer
    let dealer = await dealersCol.findOne({ name: dealerNameStr });
    if (!dealer) {
      const newDealer = {
        name: dealerNameStr,
        phone: '',
        address: '',
        notes: 'Auto-migrated from raw materials',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const res = await dealersCol.insertOne(newDealer);
      dealer = { _id: res.insertedId, ...newDealer };
      console.log(`Created new Dealer: ${dealerNameStr} (${dealer._id})`);
    }

    // Update raw material with dealerId
    await rawMaterialsCol.updateOne(
      { _id: material._id },
      { $set: { dealerId: dealer._id } }
    );
    console.log(`Updated RawMaterial ${material._id} with dealerId ${dealer._id}`);

    // Create dealerLedger purchase entry if totalAmount exists and no ledger entry yet
    if (material.totalAmount && material.totalAmount > 0) {
      const existingLedger = await dealerLedgersCol.findOne({
        refPurchaseId: material._id,
      });
      if (!existingLedger) {
        await dealerLedgersCol.insertOne({
          dealerId: dealer._id,
          type: 'purchase',
          amount: material.totalAmount,
          refPurchaseId: material._id,
          date: material.purchaseDate || material.createdAt || new Date(),
          mode: 'cash',
          notes: `Migrated purchase entry for ${material.materialName}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        console.log(`Created ledger purchase entry for RawMaterial ${material._id}`);
      }
    }
  }

  console.log('Dealer migration completed successfully.');
  await mongoose.disconnect();
}

migrateDealers().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
