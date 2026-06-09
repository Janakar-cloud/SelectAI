'use strict';
require('dotenv').config();

const express   = require('express');
const mongoose  = require('mongoose');
const helmet    = require('helmet');
const cors      = require('cors');
const rateLimit = require('express-rate-limit');

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── Security ─────────────────────────────────────────── */
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL   || 'http://localhost:8080',
    'https://selectai.it.com',
    'http://selectai.it.com',
    'http://3.7.130.187'
  ],
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

/* ── Global API rate limit ────────────────────────────── */
app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' }
}));

/* ── Routes ───────────────────────────────────────────── */
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/otp',       require('./routes/otp'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.use('/api/sessions',  require('./routes/sessions'));
app.use('/api/admin',     require('./routes/admin'));

/* ── Health check ─────────────────────────────────────── */
app.get('/api/health', (req, res) =>
  res.json({ ok: true, env: process.env.NODE_ENV, ts: new Date() })
);

/* ── 404 ──────────────────────────────────────────────── */
app.use((req, res) =>
  res.status(404).json({ message: 'API route not found.' })
);

/* ── Global error handler ─────────────────────────────── */
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[SelectAI]', err.stack || err.message);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
});

/* ── Connect MongoDB → start server ───────────────────── */
mongoose
  .connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log('[SelectAI] ✓ MongoDB connected');
    app.listen(PORT, '0.0.0.0', () =>
      console.log('[SelectAI] ✓ API server listening on port', PORT)
    );
  })
  .catch(err => {
    console.error('[SelectAI] ✗ MongoDB connection failed:', err.message);
    process.exit(1);
  });

module.exports = app;
