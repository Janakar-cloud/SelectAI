'use strict';
const router    = require('express').Router();
const rateLimit = require('express-rate-limit');
const Enquiry   = require('../models/Enquiry');

/* 5 submissions per hour per IP (unlimited in test env) */
const enqLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 100000 : 5,
  statusCode: 429,
  message: { message: 'Too many enquiries submitted from this IP. Please try again later.' }
});

/* ─────────────────────────────────────────────────────────
   POST /api/enquiries
   Submit a lead-form enquiry. Auth optional.
───────────────────────────────────────────────────────── */
router.post('/', enqLimiter, async (req, res, next) => {
  try {
    const { name, email, phone, company, message, userId } = req.body;

    /* Server-side validation */
    if (!name  || name.trim().length < 2)
      return res.status(400).json({ message: 'Please enter a valid name (min 2 characters).' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    if (!message || message.trim().length < 10)
      return res.status(400).json({ message: 'Message must be at least 10 characters.' });

    const enquiry = await Enquiry.create({
      userId:  (userId  || '').trim(),
      name:    name.trim(),
      email:   email.trim().toLowerCase(),
      phone:   (phone   || '').trim(),
      company: (company || '').trim(),
      message: message.trim()
    });

    res.status(201).json({ ok: true, id: enquiry._id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
