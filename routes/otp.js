'use strict';
const router     = require('express').Router();
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');
const { verifyToken } = require('../middleware/auth');
const OtpVerification = require('../models/OtpVerification');
const User            = require('../models/User');

/* Strict rate limit: max 3 OTP sends per 10 min per IP */
const otpSendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { message: 'Too many OTP requests. Please wait before requesting another code.' }
});

/* Lazy-init mail transporter */
let _transporter;
function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return _transporter;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ─────────────────────────────────────────────────────────
   POST /api/otp/send
   Generate a 6-digit code, store in MongoDB, email to user.
───────────────────────────────────────────────────────── */
router.post('/send', otpSendLimiter, verifyToken, async (req, res, next) => {
  try {
    const uid       = req.uid;
    const email     = req.userEmail;
    const code      = generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); /* 10 min */

    /* Upsert OTP record (replace previous code if any) */
    await OtpVerification.findOneAndUpdate(
      { uid },
      { uid, email, code, expiresAt, verified: false },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const isDev = process.env.NODE_ENV !== 'production';

    if (isDev) {
      /* In dev: log to console instead of sending email */
      console.log('[SelectAI OTP] Code for', email, '→', code);
    } else {
      await getTransporter().sendMail({
        from:    process.env.SMTP_FROM || 'SelectAI <noreply@selectai.it.com>',
        to:      email,
        subject: 'Your SelectAI Verification Code — ' + code,
        html:    buildOtpEmail(code)
      });
    }

    res.json({
      ok:      true,
      message: 'Verification code sent to ' + email,
      /* Only expose the code in non-production for testing */
      ...(isDev ? { devCode: code } : {})
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
    const { code } = req.body;
    if (!code || !/^\d{6}$/.test(code))
      return res.status(400).json({ message: 'Please enter a valid 6-digit code.' });

    const record = await OtpVerification.findOne({ uid: req.uid });
    if (!record)
      return res.status(404).json({ message: 'No OTP found. Please request a new code.' });
    if (record.verified)
      return res.json({ ok: true, message: 'Already verified.' });
    if (record.expiresAt < new Date())
      return res.status(410).json({ message: 'OTP has expired. Please request a new code.' });
    if (record.code !== String(code))
      return res.status(400).json({ message: 'Incorrect verification code. Please try again.' });

    /* Mark verified in both OtpVerification and User collections */
    await Promise.all([
      OtpVerification.findOneAndUpdate({ uid: req.uid }, { verified: true }),
      User.findOneAndUpdate({ uid: req.uid }, { verified: true })
    ]);

    res.json({ ok: true, message: 'Email verified successfully.' });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   Branded HTML OTP email template
───────────────────────────────────────────────────────── */
function buildOtpEmail(code) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Verify your SelectAI account</title></head>
<body style="margin:0;padding:0;background:#060612;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0e0e24;border:1px solid rgba(0,229,255,0.18);border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#ff006e 0%,#9b00ff 100%);padding:3px 0 0;border-radius:12px 12px 0 0;">
      <div style="background:#0e0e24;padding:32px 36px 0;border-radius:9px 9px 0 0;">
        <p style="margin:0;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#00e5ff;font-weight:700;">SelectAI Innovations</p>
        <h1 style="margin:10px 0 28px;font-size:22px;color:#e0e0f0;font-weight:700;line-height:1.2;">Verify Your Email Address</h1>
      </div>
    </div>
    <div style="padding:28px 36px 36px;">
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Welcome to SelectAI! Use the code below to complete your account verification.
        This code is valid for <strong style="color:#e0e0f0;">10 minutes</strong>.
      </p>
      <div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.22);border-radius:10px;padding:24px;text-align:center;margin:0 0 28px;">
        <p style="margin:0 0 6px;font-size:11px;color:#8890b5;letter-spacing:0.15em;text-transform:uppercase;">Your verification code</p>
        <span style="font-size:40px;font-weight:900;letter-spacing:0.45em;color:#00e5ff;font-family:'Courier New',monospace;display:inline-block;padding:4px 0;">${code}</span>
      </div>
      <p style="color:#8890b5;font-size:13px;line-height:1.6;margin:0 0 8px;">
        Enter this code in the SelectAI verification screen to activate your account.
      </p>
      <p style="color:#4a4a6a;font-size:12px;line-height:1.6;margin:0;">
        If you didn't create a SelectAI account, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid rgba(0,229,255,0.08);margin:28px 0 20px;">
      <p style="color:#4a4a6a;font-size:11px;margin:0;">
        © ${year} SelectAI Innovations &nbsp;·&nbsp;
        <a href="https://selectai.it.com" style="color:#00e5ff;text-decoration:none;">selectai.it.com</a>
      </p>
    </div>
  </div>
</body></html>`;
}

module.exports = router;
