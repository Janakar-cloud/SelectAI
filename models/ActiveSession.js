'use strict';
const mongoose = require('mongoose');

/**
 * Active user session — updated by each browser ping every 2 minutes.
 * Used to count visitors currently on the site.
 * Auto-deleted by MongoDB TTL 24 hours after last activity.
 */
const sessionSchema = new mongoose.Schema(
  {
    uid:         { type: String, required: true, unique: true },
    email:       { type: String, default: '' },
    displayName: { type: String, default: '' },
    lastActive:  { type: Date,   default: Date.now }
  },
  {
    timestamps: false
  }
);

/* TTL: remove sessions inactive for more than 24 hours */
sessionSchema.index({ lastActive: 1 }, { expireAfterSeconds: 86400 });

module.exports = mongoose.model('ActiveSession', sessionSchema);
