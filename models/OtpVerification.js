'use strict';
const mongoose = require('mongoose');

/**
 * OTP verification record.
 * One record per user (uid), replaced on each resend.
 * Auto-deleted by MongoDB TTL after 24 hours.
 */
const otpSchema = new mongoose.Schema(
  {
    uid:          { type: String, required: true, unique: true, index: true },
    email:        { type: String, required: true, index: true },
    code:         { type: String, required: true },
    expiresAt:    { type: Date,   required: true },
    verified:     { type: Boolean, default: false },
    /* Pending registration — user is created only after OTP verify */
    firstName:    { type: String, default: '' },
    lastName:     { type: String, default: '' },
    passwordHash: { type: String, default: '' },
    phone:        { type: String, default: '' },
    country:      { type: String, default: '' }
  },
  {
    timestamps: true
  }
);

/* Auto-delete 24 hours after creation */
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('OtpVerification', otpSchema);
