'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const User = require('../models/User');

/* ─────────────────────────────────────────────────────────
   POST /api/auth/user
   Upsert a user record in MongoDB after Firebase OAuth.
   Called by the frontend immediately after sign-in.
───────────────────────────────────────────────────────── */
router.post('/user', verifyToken, async (req, res, next) => {
  try {
    const uid   = req.uid;
    const email = req.userEmail;
    const { firstName, lastName, phone, country, city, provider, photoURL } = req.body;

    let user  = await User.findOne({ uid });
    let isNew = false;

    if (!user) {
      /* New user — create full record */
      isNew = true;
      const nameParts = (firstName || '').trim().split(' ');
      user = await User.create({
        uid,
        firstName: (firstName || nameParts[0] || 'User').trim(),
        lastName:  (lastName  || nameParts.slice(1).join(' ') || '').trim(),
        email:     email || '',
        phone:     (phone   || '').trim(),
        country:   (country || '').trim(),
        city:      (city    || '').trim(),
        provider:  provider || 'google',
        photoURL:  photoURL || '',
        role:      'user',
        verified:  false,
        lastLogin: new Date()
      });
    } else {
      /* Existing user — refresh lastLogin and fill any missing fields */
      user.lastLogin = new Date();
      if (photoURL  && !user.photoURL)  user.photoURL  = photoURL;
      if (phone     && !user.phone)     user.phone     = phone;
      if (country   && !user.country)   user.country   = country;
      if (city      && !user.city)      user.city      = city;
      await user.save();
    }

    res.json({
      isNew,
      user: {
        uid:       user.uid,
        firstName: user.firstName,
        lastName:  user.lastName,
        email:     user.email,
        role:      user.role,
        verified:  user.verified,
        photoURL:  user.photoURL
      }
    });
  } catch (err) {
    next(err);
  }
});

/* ─────────────────────────────────────────────────────────
   GET /api/auth/me
   Returns the current user's MongoDB record.
   Used by auth-guard.js to get the role without Firestore.
───────────────────────────────────────────────────────── */
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await User.findOne({ uid: req.uid })
      .select('-__v')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found. Please sign in again.' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
