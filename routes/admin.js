'use strict';
const router     = require('express').Router();
const jwt        = require('jsonwebtoken');
const crypto     = require('crypto');
const bcrypt     = require('bcryptjs');
const mail       = require('../lib/mail');
const {
  validatePhone,
  phoneForCountry,
  fullName,
  findRegistrationConflict
} = require('../lib/userHelpers');
const { verifyToken, requireAdmin }         = require('../middleware/auth');
const User          = require('../models/User');
const Enquiry       = require('../models/Enquiry');
const ActiveSession = require('../models/ActiveSession');

/* All admin routes require a valid token + admin role */
router.use(verifyToken, requireAdmin);

/* ─────────────────────────────────────────────────────────
   GET /api/admin/stats
───────────────────────────────────────────────────────── */
router.get('/stats', async (req, res, next) => {
  try {
    const now      = new Date();
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fiveAgo  = new Date(now.getTime() - 5 * 60 * 1000);

    const [totalUsers, newToday, totalEnquiries, activeNow] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      Enquiry.countDocuments(),
      ActiveSession.countDocuments({ lastActive: { $gte: fiveAgo } })
    ]);

    res.json({ totalUsers, newToday, totalEnquiries, activeNow });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/admin/users
───────────────────────────────────────────────────────── */
router.get('/users', async (req, res, next) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('-__v')
      .lean();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/admin/enquiries
───────────────────────────────────────────────────────── */
router.get('/enquiries', async (req, res, next) => {
  try {
    const enquiries = await Enquiry.find()
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('-__v')
      .lean();
    res.json({ enquiries });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/admin/users/:uid/reset-password
   Generates a JWT-based password reset link and emails it.
───────────────────────────────────────────────────────── */
router.post('/users/:uid/reset-password', async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.params.uid }).lean();
    if (!user)        return res.status(404).json({ message: 'User not found in database.' });
    if (!user.email)  return res.status(400).json({ message: 'User has no email address.' });

    /* Generate JWT-based password reset link (1 hour expiry) */
    const resetToken = jwt.sign(
      { uid: user.uid, email: user.email, purpose: 'pw-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const base      = (process.env.FRONTEND_URL || 'https://www.selectai.it.com').replace(/\/$/, '');
    const resetLink = `${base}/sign-in?reset=${encodeURIComponent(resetToken)}`;

    /* Send reset email via SMTP */
    if (mail.shouldSendViaSmtp()) {
      try {
        await mail.send({
          to:      user.email,
          subject: 'Reset Your SelectAI Password — Action Requested by Admin',
          html:    buildResetEmail(fullName(user.firstName, user.lastName) || 'User', resetLink)
        });
      } catch (smtpErr) {
        console.error('[SelectAI Admin] SMTP error (reset-password):', smtpErr.message, smtpErr.code || '');
        return res.status(502).json({ message: 'Failed to send reset email. Please try again later.' });
      }
    } else {
      console.log('[SelectAI Admin] Password reset link for', user.email, ':', resetLink);
    }

    res.json({ ok: true, message: 'Password reset email sent to ' + user.email });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/admin/users
   Create a new user account from the admin panel.
───────────────────────────────────────────────────────── */
router.post('/users', async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, phone, country, role } = req.body;

    if (!firstName || firstName.trim().length < 2)
      return res.status(400).json({ message: 'First name must be at least 2 characters.' });
    if (!lastName || lastName.trim().length < 2)
      return res.status(400).json({ message: 'Last name must be at least 2 characters.' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!password || password.length < 8)
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });

    const safeRole = (role === 'admin') ? 'admin' : 'user';
    const emailLower = email.toLowerCase().trim();
    const countryVal = (country || '').trim();
    const phoneError = validatePhone(phone, countryVal);
    if (phoneError) return res.status(400).json({ message: phoneError });
    const phoneNorm  = phoneForCountry(phone, countryVal);

    const conflict = await findRegistrationConflict(emailLower);
    if (conflict) return res.status(409).json({ message: conflict.message });

    const passwordHash = await bcrypt.hash(password, 12);
    const uid          = crypto.randomUUID();

    const user = await User.create({
      uid,
      firstName: firstName.trim(),
      lastName:  lastName.trim(),
      email:     emailLower,
      passwordHash,
      phone:     phoneNorm,
      country:   countryVal,
      role:      safeRole,
      provider:  'email',
      verified:  true,
      lastLogin: new Date()
    });

    res.status(201).json({
      ok: true,
      message: 'User created successfully.',
      user: {
        uid:       user.uid,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        verified:  user.verified,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   PATCH /api/admin/users/:uid/role
   Toggle a user's role between 'user' and 'admin'.
───────────────────────────────────────────────────────── */
router.patch('/users/:uid/role', async (req, res, next) => {
  try {
    const { role } = req.body;
    if (role !== 'admin' && role !== 'user')
      return res.status(400).json({ message: 'Role must be "admin" or "user".' });

    /* Prevent admin from demoting themselves */
    if (req.uid === req.params.uid && role !== 'admin')
      return res.status(400).json({ message: 'You cannot remove your own admin access.' });

    const result = await User.findOneAndUpdate(
      { uid: req.params.uid },
      { $set: { role } },
      { new: true, select: 'uid email role' }
    ).lean();

    if (!result)
      return res.status(404).json({ message: 'User not found.' });

    res.json({ ok: true, message: 'Role updated.', user: result });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   DELETE /api/admin/users/:uid
   Permanently delete a user account.
───────────────────────────────────────────────────────── */
router.delete('/users/:uid', async (req, res, next) => {
  try {
    /* Prevent admin from deleting themselves */
    if (req.uid === req.params.uid)
      return res.status(400).json({ message: 'You cannot delete your own account.' });

    const result = await User.deleteOne({ uid: req.params.uid });
    if (result.deletedCount === 0)
      return res.status(404).json({ message: 'User not found.' });

    res.json({ ok: true, message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   Password reset email HTML template
───────────────────────────────────────────────────────── */
function buildResetEmail(name, resetLink) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Reset Your SelectAI Password</title></head>
<body style="margin:0;padding:0;background:#060612;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0e0e24;border:1px solid rgba(0,229,255,0.18);border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#ff006e 0%,#9b00ff 100%);padding:3px 0 0;border-radius:12px 12px 0 0;">
      <div style="background:#0e0e24;padding:32px 36px 0;border-radius:9px 9px 0 0;">
        <p style="margin:0;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#00e5ff;font-weight:700;">SelectAI Innovations</p>
        <h1 style="margin:10px 0 28px;font-size:22px;color:#e0e0f0;font-weight:700;">Password Reset Request</h1>
      </div>
    </div>
    <div style="padding:28px 36px 36px;">
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 20px;">Hi ${name},</p>
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 28px;">
        An administrator has requested a password reset for your account. Click the button below to set a new password. This link expires in <strong style="color:#e0e0f0;">1 hour</strong>.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#ff006e,#9b00ff);color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:14px;letter-spacing:0.05em;">Reset My Password</a>
      </div>
      <p style="color:#4a4a6a;font-size:12px;line-height:1.6;margin:0 0 8px;">
        If the button doesn't work, copy this link: <br>
        <a href="${resetLink}" style="color:#00e5ff;word-break:break-all;">${resetLink}</a>
      </p>
      <p style="color:#4a4a6a;font-size:12px;line-height:1.6;margin:16px 0 0;">
        If you didn't request this, please ignore this email. Your password will not change.
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
