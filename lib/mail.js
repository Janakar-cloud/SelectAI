'use strict';
const nodemailer = require('nodemailer');

let _transporter;

function isSmtpConfigured() {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

/** Production with valid SMTP credentials — send real email. */
function shouldSendViaSmtp() {
  return process.env.NODE_ENV === 'production' && isSmtpConfigured();
}

/** Dev/test or SMTP not configured — log instead of sending. */
function isDevMailMode() {
  return !shouldSendViaSmtp();
}

/**
 * Resolve a From address compatible with the SMTP provider.
 * Gmail rejects mail when From does not match the authenticated account.
 */
function getFromAddress() {
  const user = (process.env.SMTP_USER || '').trim();
  const from = (process.env.SMTP_FROM || '').trim();
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').toLowerCase();

  if (!user) {
    return from || 'SelectAI <noreply@selectai.it.com>';
  }

  const fromEmail = (from.match(/<([^>]+)>/) || [])[1] || from;
  const useAuthUserAsFrom =
    host.includes('gmail') ||
    !from ||
    (fromEmail && fromEmail.toLowerCase() !== user.toLowerCase());

  if (useAuthUserAsFrom) {
    return `SelectAI <${user}>`;
  }

  return from;
}

function getTransporter() {
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  return _transporter;
}

/** Reset singleton (tests only). */
function _resetTransporter() {
  _transporter = undefined;
}

async function send({ to, subject, html }) {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured (SMTP_USER and SMTP_PASS required).');
  }

  return getTransporter().sendMail({
    from:    getFromAddress(),
    to,
    subject,
    html
  });
}

module.exports = {
  isSmtpConfigured,
  shouldSendViaSmtp,
  isDevMailMode,
  getFromAddress,
  getTransporter,
  send,
  _resetTransporter
};
