'use strict';
const router     = require('express').Router();
const { createLimiter } = require('../lib/rateLimit');
const { verifyToken } = require('../middleware/auth');
const mail            = require('../lib/mail');
const { issueOtp }    = require('../lib/otpService');
const { findRegistrationConflict } = require('../lib/userHelpers');
const OtpVerification = require('../models/OtpVerification');
const User            = require('../models/User');

/* Strict rate limit: max 3 OTP sends per 10 min per IP (unlimited in test env) */
const otpSendLimiter = createLimiter({
  windowMs: 10 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100000 : 3,
  statusCode: 429,
  message: { message: 'Too many OTP requests. Please wait before requesting another code.' }
});

/* ─────────────────────────────────────────────────────────
   POST /api/otp/send
   Generate a 6-digit code, store in MongoDB, email to user.
───────────────────────────────────────────────────────── */
router.post('/send', otpSendLimiter, verifyToken, async (req, res, next) => {
  try {
    const uid    = req.uid;
    const user   = await User.findOne({ uid }).select('email').lean();
    const pending = await OtpVerification.findOne({ uid }).lean();
    const email  = ((user && user.email) || (pending && pending.email) || req.userEmail || '').trim().toLowerCase();

    if (!email)
      return res.status(400).json({ message: 'No email address associated with this account.' });

    const preserve = pending ? {
      firstName:    pending.firstName,
      lastName:     pending.lastName,
      passwordHash: pending.passwordHash,
      phone:        pending.phone,
      country:      pending.country,
      city:         pending.city
    } : {};

    const isDev = mail.isDevMailMode();
    let otpResult;
    try {
      otpResult = await issueOtp(uid, email, preserve);
    } catch (smtpErr) {
      console.error('[SelectAI OTP] SMTP error:', smtpErr.message, smtpErr.code || '');
      return res.status(502).json({ message: 'Failed to send verification email. Please try again.' });
    }

    res.json({
      ok:      true,
      message: 'Verification code sent to ' + email,
      ...(otpResult.isDev ? { devCode: otpResult.code } : {})
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/otp/verify
   Verify the 6-digit code entered by the user.
───────────────────────────────────────────────────────── */
router.post('/verify', verifyToken, async (req, res, next) => {
  try {
    const enteredCode = String(req.body.code || '').trim();
    if (!enteredCode || !/^\d{6}$/.test(enteredCode))
      return res.status(400).json({ message: 'Please enter a valid 6-digit code.' });

    let record = await OtpVerification.findOne({ uid: req.uid });
    if (!record) {
      const user = await User.findOne({ uid: req.uid }).select('email').lean();
      const email = ((user && user.email) || req.userEmail || '').trim().toLowerCase();
      if (email) record = await OtpVerification.findOne({ email });
    }

    if (!record)
      return res.status(404).json({ message: 'No OTP found. Please request a new code.' });
    if (record.verified)
      return res.json({ ok: true, message: 'Already verified.' });
    if (record.expiresAt < new Date())
      return res.status(410).json({ message: 'OTP has expired. Please request a new code.' });
    if (String(record.code).trim() !== enteredCode)
      return res.status(400).json({ message: 'Incorrect verification code. Please try again.' });

    if (record.passwordHash) {
      const conflict = await findRegistrationConflict(record.email, record.phone, record.uid);
      if (conflict) return res.status(409).json({ message: conflict.message });

      const existingUser = await User.findOne({ uid: record.uid }).lean();
      if (!existingUser) {
        await User.create({
          uid:          record.uid,
          firstName:    record.firstName,
          lastName:     record.lastName,
          email:        record.email,
          passwordHash: record.passwordHash,
          phone:        record.phone,
          country:      record.country,
          city:         record.city,
          provider:     'email',
          role:         'user',
          verified:     true,
          lastLogin:    new Date()
        });
      } else {
        await User.findOneAndUpdate({ uid: record.uid }, { verified: true });
      }
    } else {
      await User.findOneAndUpdate({ uid: req.uid }, { verified: true });
    }

    await OtpVerification.findOneAndUpdate({ uid: record.uid }, { verified: true });

    res.json({ ok: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
