'use strict';
/**
 * scripts/seed-admin.js
 * ---------------------
 * Creates (or promotes) janakar.ganesan@gmail.com as an admin user.
 *
 * Usage (run from project root):
 *   node scripts/seed-admin.js
 *
 * Requires: MONGODB_URI in .env  (or set as environment variable)
 * The admin can change the password via "Forgot Password" from the login page.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const ADMIN_EMAIL     = 'janakar.ganesan@gmail.com';
const ADMIN_FIRST     = 'Janakar';
const ADMIN_LAST      = 'Ganesan';
const TEMP_PASSWORD   = 'SelectAI@2026';   // change after first login

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not set. Add it to your .env file.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('✓ Connected to MongoDB');

  /* Inline schema so this script is self-contained */
  const User = require('../models/User');

  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    /* Promote to admin if not already */
    if (existing.role === 'admin') {
      console.log('✓ User', ADMIN_EMAIL, 'already exists and is already an admin. No changes made.');
    } else {
      await User.updateOne({ email: ADMIN_EMAIL }, { $set: { role: 'admin' } });
      console.log('✓ User', ADMIN_EMAIL, 'promoted to admin.');
    }
  } else {
    /* Create fresh admin account */
    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
    await User.create({
      uid:          crypto.randomUUID(),
      firstName:    ADMIN_FIRST,
      lastName:     ADMIN_LAST,
      email:        ADMIN_EMAIL,
      passwordHash,
      phone:        '',
      country:      'India',
      city:         '',
      role:         'admin',
      provider:     'email',
      verified:     true,
      lastLogin:    new Date()
    });
    console.log('✓ Admin user created.');
    console.log('  Email   :', ADMIN_EMAIL);
    console.log('  Password:', TEMP_PASSWORD);
    console.log('  ⚠  Please change this password via the login page after first sign-in.');
  }

  await mongoose.disconnect();
  console.log('✓ Done.');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
