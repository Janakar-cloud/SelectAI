'use strict';
/**
 * tests/testApp.js
 * Creates the Express app WITHOUT connecting to MongoDB.
 * Mongoose model calls are mocked per-test via jest.mock().
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

/* Ensure JWT_SECRET is set for tests */
process.env.JWT_SECRET   = process.env.JWT_SECRET   || 'test-secret-key-for-jest-at-least-32-chars-long';
process.env.MONGODB_URI  = process.env.MONGODB_URI  || 'mongodb://127.0.0.1:27017/selectai_test';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'https://www.selectai.it.com';
process.env.NODE_ENV     = 'test';

const express   = require('express');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => { req.body = req.body || {}; next(); });

/* Relax rate limit in test */
app.use('/api/', rateLimit({ windowMs: 60000, max: 10000 }));

app.use('/api/auth',      require('../routes/auth'));
app.use('/api/otp',       require('../routes/otp'));
app.use('/api/enquiries', require('../routes/enquiries'));
app.use('/api/sessions',  require('../routes/sessions'));
app.use('/api/admin',     require('../routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res) => res.status(404).json({ message: 'Not found.' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
});

module.exports = app;
