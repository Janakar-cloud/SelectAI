'use strict';
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Verify JWT in Authorization: Bearer <token> header.
 * Sets req.uid and req.userEmail on success.
 */
async function verifyToken(req, res, next) {
  const raw    = req.headers.authorization || '';
  const token  = raw.startsWith('Bearer ') ? raw.slice(7).trim() : null;
  if (!token) return res.status(401).json({ message: 'Missing authentication token.' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.uid       = decoded.uid;
    req.userEmail = decoded.email || '';
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
    const user = await User.findOne({ uid: req.uid }).select('role').lean();
    if (!user || user.role !== 'admin')
      return res.status(403).json({ message: 'Admin access required.' });
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { verifyToken, requireAdmin };
