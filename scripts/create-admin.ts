/* eslint-disable prettier/prettier */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcrypt';

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = (args[0] || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = args[1] || process.env.ADMIN_PASSWORD || '';
  const firstname = args[2] || 'Super';
  const lastname = args[3] || 'Admin';

  if (!email || !password) {
    console.error(`
❌ Usage:
  npm run create:admin <email> <password> [firstname] [lastname]

Or set ADMIN_EMAIL and ADMIN_PASSWORD in your .env file.

Example:
  npm run create:admin admin@accurateliquid.com MySecurePassword123 Admin User
`);
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Password must be at least 8 characters long.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is not set in environment or .env file.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  if (!db) {
    console.error('❌ Failed to access database connection.');
    process.exit(1);
  }

  const usersCollection = db.collection('users');
  const adminsCollection = db.collection('admins');

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const existing = await usersCollection.findOne({ email });

  let userId: any;

  if (existing) {
    console.log(`User ${email} already exists. Upgrading to admin and updating password...`);
    const currentRoles: string[] = Array.isArray(existing.roles) ? existing.roles : [];
    const roles = Array.from(new Set([...currentRoles, 'admin', 'user']));

    await usersCollection.updateOne(
      { _id: existing._id },
      {
        $set: {
          password: hashedPassword,
          roles,
          isActive: true,
          firstname: existing.firstname || firstname,
          lastname: existing.lastname || lastname,
          updatedAt: new Date(),
        },
      },
    );
    userId = existing._id;
    console.log(`✅ User ${email} updated with ADMIN role.`);
  } else {
    console.log(`Creating new Admin user: ${email}...`);
    const result = await usersCollection.insertOne({
      email,
      password: hashedPassword,
      firstname,
      lastname,
      username: email.split('@')[0],
      roles: ['admin', 'user'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    userId = result.insertedId;
    console.log(`✅ Admin user ${email} created.`);
  }

  // Ensure Admin collection document exists
  const existingAdminProfile = await adminsCollection.findOne({ user: userId });
  if (!existingAdminProfile) {
    await adminsCollection.insertOne({
      user: userId,
      status: 'active',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('✅ Admin profile linked in admins collection.');
  }

  console.log(`
🎉 Admin account ready!
Email: ${email}
Role: admin
You can now log in at your web app or admin portal.
`);

  await mongoose.disconnect();
  process.exit(0);
}

createAdmin().catch((err) => {
  console.error('❌ Error creating admin:', err);
  process.exit(1);
});
