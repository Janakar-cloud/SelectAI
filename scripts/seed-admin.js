'use strict';
/**
 * scripts/seed-admin.js
 * ---------------------
 * 1. Initialises all MongoDB collections and indexes (User, Enquiry,
 *    OtpVerification, ActiveSession).
 * 2. Creates (or promotes) janakar.ganesan@gmail.com as the admin user.
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
const ADMIN_PHONE     = '+91-9999999999';
const ADMIN_COUNTRY   = 'IN';
const TEMP_PASSWORD   = 'SelectAI@2026';   // change after first login

async function seed() {
  if (!process.env.MONGODB_URI) {
    console.error('ERROR: MONGODB_URI not set. Add it to your .env file.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('✓ Connected to MongoDB');

  /* ── Step 1: Load all models so Mongoose creates collections + indexes ── */
  const User            = require('../models/User');
  const Enquiry         = require('../models/Enquiry');
  const OtpVerification = require('../models/OtpVerification');
  const ActiveSession   = require('../models/ActiveSession');

  /* ensureIndexes() syncs all schema indexes to MongoDB */
  await Promise.all([
    User.ensureIndexes(),
    Enquiry.ensureIndexes(),
    OtpVerification.ensureIndexes(),
    ActiveSession.ensureIndexes()
  ]);
  console.log('✓ Collections and indexes initialised:');
  console.log('    users, enquiries, otpverifications, activesessions');

  /* ── Step 2: Create or promote the admin account ──────────────────────── */
  const existing = await User.findOne({ email: ADMIN_EMAIL });

  if (existing) {
    const updates = {};
    if (existing.role !== 'admin')     updates.role     = 'admin';
    if (!existing.verified)            updates.verified  = true;
    if (!existing.phone && ADMIN_PHONE)   updates.phone  = ADMIN_PHONE;
    if (!existing.country)             updates.country  = ADMIN_COUNTRY;

    if (Object.keys(updates).length) {
      await User.updateOne({ email: ADMIN_EMAIL }, { $set: updates });
      console.log('✓ Existing user updated:', JSON.stringify(updates));
    } else {
      console.log('✓ Admin user already up-to-date. No changes needed.');
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
      phone:        ADMIN_PHONE.replace(/\D/g, ''),
      country:      ADMIN_COUNTRY,
      role:         'admin',
      provider:     'email',
      verified:     true,
      lastLogin:    new Date()
    });
    console.log('✓ Admin user created.');
    console.log('  Name    :', ADMIN_FIRST, ADMIN_LAST);
    console.log('  Email   :', ADMIN_EMAIL);
    console.log('  Phone   :', ADMIN_PHONE);
    console.log('  Location:', ADMIN_CITY + ',', ADMIN_COUNTRY);
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
