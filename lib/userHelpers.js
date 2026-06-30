'use strict';

const OtpVerification = require('../models/OtpVerification');
const User            = require('../models/User');

function isIndiaCountry(country) {
  const c = String(country || '').trim().toUpperCase();
  return c === 'IN' || c === 'INDIA';
}

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 ? digits : '';
}

function validatePhone(phone, country) {
  if (!isIndiaCountry(country)) return '';
  const normalized = normalizePhone(phone);
  if (!normalized) return 'Please enter a valid mobile number (at least 8 digits).';
  if (normalized.length > 15) return 'Mobile number is too long.';
  return '';
}

function phoneForCountry(phone, country) {
  if (!isIndiaCountry(country)) return '';
  return normalizePhone(phone);
}

function fullName(firstName, lastName) {
  return [firstName, lastName].map(function (v) { return (v || '').trim(); }).filter(Boolean).join(' ');
}

async function findRegistrationConflict(emailLower, excludeUid) {
  const userEmail = await User.findOne({ email: emailLower }).lean();
  if (userEmail && userEmail.uid !== excludeUid)
    return { message: 'An account with this email already exists.' };

  const pendingEmail = await OtpVerification.findOne({
    email: emailLower,
    verified: false,
    passwordHash: { $nin: ['', null] },
    ...(excludeUid ? { uid: { $ne: excludeUid } } : {})
  }).lean();
  if (pendingEmail)
    return { message: 'Registration is already in progress for this email. Check your inbox or complete verification.' };

  return null;
}

module.exports = {
  isIndiaCountry,
  normalizePhone,
  validatePhone,
  phoneForCountry,
  fullName,
  findRegistrationConflict
};
