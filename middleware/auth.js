'use strict';
const admin = require('firebase-admin');

/* Initialise Firebase Admin SDK once */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    })
  });
}

/**
 * Verify Firebase ID token in Authorization: Bearer <token> header.
 * Sets req.uid and req.userEmail on success.
 */
async function verifyToken(req, res, next) {
  const raw   = req.headers.authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return res.status(401).json({ message: 'Missing authentication token.' });

  try {
    const decoded  = await admin.auth().verifyIdToken(token);
    req.uid        = decoded.uid;
    req.userEmail  = decoded.email || '';
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

/**
 * Require admin role — must come after verifyToken.
 */
async function requireAdmin(req, res, next) {
  try {
    const User = require('../models/User');
    const user = await User.findOne({ uid: req.uid }).select('role').lean();
    if (!user || user.role !== 'admin')
      return res.status(403).json({ message: 'Admin access required.' });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyToken, requireAdmin, admin };
