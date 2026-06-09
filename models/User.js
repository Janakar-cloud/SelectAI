'use strict';
const mongoose = require('mongoose');

/**
 * User schema — mirrors the data collected at sign-up.
 * uid is the Firebase Auth UID (primary key for cross-referencing).
 */
const userSchema = new mongoose.Schema(
  {
    uid:       { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true, trim: true },
    lastName:  { type: String, required: true, trim: true },
    email:     { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone:     { type: String, default: '',     trim: true },
    country:   { type: String, default: '',     trim: true },
    city:      { type: String, default: '',     trim: true },
    role:      { type: String, enum: ['user', 'admin'], default: 'user' },
    provider:  { type: String, enum: ['google', 'apple', 'email'], default: 'google' },
    photoURL:  { type: String, default: '' },
    verified:  { type: Boolean, default: false },
    lastLogin: { type: Date,    default: Date.now }
  },
  {
    timestamps: true   /* adds createdAt + updatedAt automatically */
  }
);

/* Compound text index for admin search */
userSchema.index({ firstName: 'text', lastName: 'text', email: 'text' });

module.exports = mongoose.model('User', userSchema);
