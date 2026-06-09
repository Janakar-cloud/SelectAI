'use strict';
const router = require('express').Router();
const { verifyToken } = require('../middleware/auth');
const ActiveSession   = require('../models/ActiveSession');

/* ─────────────────────────────────────────────────────────
   POST /api/sessions/ping
   Upsert the user's active session.
   Called by the browser every 2 minutes while the page is open.
───────────────────────────────────────────────────────── */
router.post('/ping', verifyToken, async (req, res, next) => {
  try {
    await ActiveSession.findOneAndUpdate(
      { uid: req.uid },
      {
        uid:         req.uid,
        email:       req.userEmail,
        displayName: (req.body.displayName || '').trim(),
        lastActive:  new Date()
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
