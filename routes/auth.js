'use strict';
const router     = require('express').Router();
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const jwt        = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const mail       = require('../lib/mail');
const User = require('../models/User');

const BCRYPT_ROUNDS = 12;

function _signToken(uid, email, role) {
  return jwt.sign(
    { uid, email, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function _validatePassword(pw) {
  if (!pw || pw.length < 8)  return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(pw))     return 'Password must contain at least one uppercase letter.';
  if (!/[0-9]/.test(pw))     return 'Password must contain at least one number.';
  return '';
}

/* ─────────────────────────────────────────────────────────
   POST /api/auth/register
   Create a new user account with email + password.
───────────────────────────────────────────────────────── */
router.post('/register', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, country, city } = req.body;

    if (!firstName || firstName.trim().length < 2)
      return res.status(400).json({ message: 'First name must be at least 2 characters.' });
    if (!lastName  || lastName.trim().length  < 2)
      return res.status(400).json({ message: 'Last name must be at least 2 characters.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!country)
      return res.status(400).json({ message: 'Please select your country.' });
    if (!city || city.trim().length < 2)
      return res.status(400).json({ message: 'Please enter your city (min 2 characters).' });

    const pwError = _validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    const emailLower = email.toLowerCase().trim();
    const existing   = await User.findOne({ email: emailLower }).lean();
    if (existing)
      return res.status(409).json({ message: 'An account with this email already exists.' });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const uid          = crypto.randomUUID();

    const user = await User.create({
      uid,
      firstName:    firstName.trim(),
      lastName:     lastName.trim(),
      email:        emailLower,
      passwordHash,
      phone:        (phone   || '').trim(),
      country:      (country || '').trim(),
      city:         (city    || '').trim(),
      provider:     'email',
      role:         'user',
      verified:     false,
      lastLogin:    new Date()
    });

    const token = _signToken(uid, user.email, user.role);
    res.status(201).json({
      token,
      user: {
        uid:       user.uid,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        verified:  user.verified
      }
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/auth/login
   Authenticate with email + password, return JWT.
───────────────────────────────────────────────────────── */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !user.passwordHash) {
      /* Constant-time response to avoid user enumeration */
      await bcrypt.hash('dummy', 1);
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match)
      return res.status(401).json({ message: 'Invalid email or password.' });

    if (!user.verified) {
      const token = _signToken(user.uid, user.email, user.role);
      return res.status(403).json({
        message: 'Please verify your email before signing in. Check your inbox for the verification code.',
        needsVerification: true,
        token,
        user: {
          uid:       user.uid,
          firstName: user.firstName,
          lastName:  user.lastName,
          email:     user.email,
          role:      user.role,
          verified:  false
        }
      });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = _signToken(user.uid, user.email, user.role);
    res.json({
      token,
      user: {
        uid:       user.uid,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        verified:  user.verified,
        photoURL:  user.photoURL || ''
      }
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/auth/me
   Returns the current user's MongoDB record (JWT required).
───────────────────────────────────────────────────────── */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.uid })
      .select('-__v -passwordHash')
      .lean();
    if (!user) return res.status(404).json({ message: 'User not found. Please sign in again.' });
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/auth/forgot-password
   Generate a password-reset link and email it.
───────────────────────────────────────────────────────── */
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Please enter a valid email address.' });

    const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
    let devResetLink;

    /* Always return the same message — don't reveal account existence */
    if (user) {
      const resetToken = jwt.sign(
        { uid: user.uid, email: user.email, purpose: 'pw-reset' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
      const base      = (process.env.FRONTEND_URL || 'https://www.selectai.it.com').replace(/\/$/, '');
      const resetLink = `${base}/login.html?reset=${encodeURIComponent(resetToken)}`;

      if (mail.shouldSendViaSmtp()) {
        try {
          await mail.send({
            to:      user.email,
            subject: 'Reset Your SelectAI Password',
            html:    _buildForgotEmail(user.firstName || 'User', resetLink)
          });
        } catch (smtpErr) {
          console.error(
            '[SelectAI] SMTP error (forgot-password):',
            smtpErr.message,
            smtpErr.code || '',
            'from=',
            mail.getFromAddress()
          );
          return res.status(502).json({ message: 'Failed to send reset email. Please try again later.' });
        }
      } else {
        console.log('[SelectAI] Password reset link for', user.email, '→', resetLink);
        devResetLink = resetLink;
      }
    }

    res.json({
      ok: true,
      message: 'If an account exists for that email, a reset link has been sent.',
      ...(devResetLink ? { devResetLink } : {})
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/auth/reset-password
   Consume a reset token and set a new password.
───────────────────────────────────────────────────────── */
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ message: 'Reset token and new password are required.' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'Password reset link is invalid or has expired.' });
    }

    if (decoded.purpose !== 'pw-reset')
      return res.status(400).json({ message: 'Invalid reset token.' });

    const pwError = _validatePassword(password);
    if (pwError) return res.status(400).json({ message: pwError });

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = await User.updateOne(
      { uid: decoded.uid },
      { $set: { passwordHash } }
    );
    if (result.matchedCount === 0)
      return res.status(404).json({ message: 'User account not found.' });

    res.json({ ok: true, message: 'Password updated. You can now sign in with your new password.' });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   Email template — forgot password
───────────────────────────────────────────────────────── */
function _buildForgotEmail(firstName, resetLink) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Reset Your SelectAI Password</title></head>
<body style="margin:0;padding:0;background:#060612;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0e0e24;border:1px solid rgba(0,229,255,0.18);border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#ff006e 0%,#9b00ff 100%);padding:3px 0 0;border-radius:12px 12px 0 0;">
      <div style="background:#0e0e24;padding:32px 36px 0;border-radius:9px 9px 0 0;">
        <p style="margin:0;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#00e5ff;font-weight:700;">SelectAI Innovations</p>
        <h1 style="margin:10px 0 28px;font-size:22px;color:#e0e0f0;font-weight:700;">Reset Your Password</h1>
      </div>
    </div>
    <div style="padding:28px 36px 36px;">
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 20px;">Hi ${firstName},</p>
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 28px;">
        We received a request to reset your password. Click below to choose a new one. This link expires in <strong style="color:#e0e0f0;">1 hour</strong>.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#ff006e,#9b00ff);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.05em;">Reset My Password</a>
      </div>
      <p style="color:#4a4a6a;font-size:12px;line-height:1.6;margin:0 0 8px;">
        If the button doesn't work, copy this link:<br>
        <a href="${resetLink}" style="color:#00e5ff;word-break:break-all;">${resetLink}</a>
      </p>
      <p style="color:#4a4a6a;font-size:12px;line-height:1.6;margin:16px 0 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid rgba(0,229,255,0.08);margin:28px 0 20px;">
      <p style="color:#4a4a6a;font-size:11px;margin:0;">
        © ${year} SelectAI Innovations &nbsp;·&nbsp;
        <a href="https://www.selectai.it.com" style="color:#00e5ff;text-decoration:none;">www.selectai.it.com</a>
      </p>
    </div>
  </div>
</body></html>`;
}

module.exports = router;
