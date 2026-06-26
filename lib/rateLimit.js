'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Behind nginx / ALB, Express must trust X-Forwarded-* headers.
 * Also disable express-rate-limit's strict X-Forwarded-For check so
 * login/API never crash when proxy settings differ between environments.
 */
function configureTrustProxy(app) {
  if (process.env.TRUST_PROXY === '0') {
    app.set('trust proxy', false);
    return;
  }
  if (process.env.TRUST_PROXY === '1' || process.env.TRUST_PROXY === 'true') {
    app.set('trust proxy', 1);
    return;
  }
  /* Default: trust first proxy hop (nginx on same host) */
  app.set('trust proxy', 1);
}

function createLimiter(options) {
  return rateLimit(Object.assign({
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
  }, options || {}));
}

module.exports = { configureTrustProxy, createLimiter };
