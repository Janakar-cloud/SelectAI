'use strict';
const router     = require('express').Router();
const nodemailer = require('nodemailer');
const jwt                                   = require('jsonwebtoken');
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
    const base      = (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');
    const resetLink = `${base}/login.html?reset=${encodeURIComponent(resetToken)}`;

    /* Send reset email via SMTP */
    if (process.env.SMTP_USER) {
      const transporter = nodemailer.createTransport({
        host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
        port:   parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || 'SelectAI <noreply@selectai.it.com>',
        to:      user.email,
        subject: 'Reset Your SelectAI Password — Action Requested by Admin',
        html:    buildResetEmail(user.firstName || 'User', resetLink)
      });
    } else {
      /* Dev mode: log link to console */
      console.log('[SelectAI Admin] Password reset link for', user.email, ':', resetLink);
    }

    res.json({ ok: true, message: 'Password reset email sent to ' + user.email });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   Password reset email HTML template
───────────────────────────────────────────────────────── */
function buildResetEmail(firstName, resetLink) {
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
      <p style="color:#8890b5;font-size:14px;line-height:1.7;margin:0 0 20px;">Hi ${firstName},</p>
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
        <a href="https://selectai.it.com" style="color:#00e5ff;text-decoration:none;">selectai.it.com</a>
      </p>
    </div>
  </div>
</body></html>`;
}

module.exports = router;
