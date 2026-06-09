'use strict';
const mongoose = require('mongoose');

/**
 * Enquiry (lead form submission) schema.
 * userId is the Firebase UID of the submitter, empty if not logged in.
 */
const enquirySchema = new mongoose.Schema(
  {
    userId:  { type: String, default: '', index: true },
    name:    { type: String, required: true, trim: true },
    email:   { type: String, required: true, lowercase: true, trim: true },
    phone:   { type: String, default: '',    trim: true },
    company: { type: String, default: '',    trim: true },
    message: { type: String, required: true, trim: true }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Enquiry', enquirySchema);
