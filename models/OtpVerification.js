'use strict';
const mongoose = require('mongoose');

/**
 * OTP verification record.
 * One record per user (uid), replaced on each resend.
 * Auto-deleted by MongoDB TTL after 24 hours.
 */
const otpSchema = new mongoose.Schema(
  {
    uid:       { type: String, required: true, unique: true, index: true },
    email:     { type: String, required: true },
    code:      { type: String, required: true },
    expiresAt: { type: Date,   required: true },
    verified:  { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

/* Auto-delete 24 hours after creation */
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('OtpVerification', otpSchema);
