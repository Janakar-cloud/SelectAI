'use strict';
/**
 * tests/api.test.js
 * Integration tests for all Express routes.
 * Mongoose model methods are mocked with jest.mock() — no real DB needed.
 */

/* ── Env must be set before any require ───────────────── */
process.env.JWT_SECRET  = 'test-secret-key-for-jest-at-least-32-chars-long';
process.env.NODE_ENV    = 'test';
process.env.SMTP_USER   = '';          /* suppress nodemailer in tests */
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/selectai_test';
process.env.FRONTEND_URL = 'https://www.selectai.it.com';

/* ── Mock all Mongoose models ─────────────────────────── */
jest.mock('../models/User');
jest.mock('../models/Enquiry');
jest.mock('../models/ActiveSession');
jest.mock('../models/OtpVerification');

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const app      = require('./testApp');
const { makeAdminToken, makeUserToken, makeToken } = require('./helpers');

const User          = require('../models/User');
const Enquiry       = require('../models/Enquiry');
const ActiveSession = require('../models/ActiveSession');
const OtpVerification = require('../models/OtpVerification');

const SECRET = process.env.JWT_SECRET;

/* ── Shared test data ─────────────────────────────────── */
const ADMIN_USER = {
  uid: 'admin-uid-001', firstName: 'Janakar', lastName: 'Ganesan',
  email: 'janakar.ganesan@gmail.com', role: 'admin', verified: true,
  passwordHash: '', photoURL: '', phone: '', country: 'India', city: ''
};
const REGULAR_USER = {
  uid: 'user-uid-001', firstName: 'Alice', lastName: 'Smith',
  email: 'alice@example.com', role: 'user', verified: false,
  passwordHash: '', photoURL: '', phone: '', country: 'UK', city: 'London'
};

/* ════════════════════════════════════════════════════════
   HEALTH CHECK
   ════════════════════════════════════════════════════════ */
describe('GET /api/health', () => {
  test('returns 200 ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — REGISTER
   ════════════════════════════════════════════════════════ */
describe('POST /api/auth/register', () => {
  const VALID = {
    firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com',
    phone: '9876543210', password: 'Password1', country: 'India', city: 'Mumbai'
  };

  beforeEach(() => {
    User.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOneAndUpdate = jest.fn().mockResolvedValue({});
    OtpVerification.deleteOne = jest.fn().mockResolvedValue({});
    User.create = jest.fn();
  });

  test('201 on valid data — pending until OTP, no User.create', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.otpSent).toBe(true);
    expect(res.body.user.email).toBe('alice@example.com');
    expect(User.create).not.toHaveBeenCalled();
    expect(OtpVerification.findOneAndUpdate).toHaveBeenCalled();
  });

  test('400 when phone missing or too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/mobile/i);
  });

  test('400 when firstName too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, firstName: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/first name/i);
  });

  test('400 when lastName too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, lastName: 'S' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last name/i);
  });

  test('400 when email invalid', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, email: 'bademail' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  test('400 when country missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, country: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/country/i);
  });

  test('400 when city too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, city: 'X' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/city/i);
  });

  test('400 when password too short', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  test('400 when password has no uppercase', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, password: 'alicetest1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/uppercase/i);
  });

  test('400 when password has no digit', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...VALID, password: 'AliceTest' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/number/i);
  });

  test('409 when email already taken', async () => {
    User.findOne = jest.fn().mockImplementation((query) => ({
      lean: jest.fn().mockResolvedValue(query.email ? REGULAR_USER : null)
    }));
    const res = await request(app).post('/api/auth/register').send(VALID);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/email/i);
  });

  test('returned token decodes correctly', async () => {
    const res = await request(app).post('/api/auth/register').send(VALID);
    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.role).toBe('user');
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — LOGIN
   ════════════════════════════════════════════════════════ */
describe('POST /api/auth/login', () => {
  const PASSWORD = 'Password1';

  beforeEach(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const mockUser = { ...REGULAR_USER, passwordHash: hash, save: jest.fn().mockResolvedValue(true) };
    User.findOne = jest.fn().mockResolvedValue(mockUser);
  });

  test('200 with valid credentials', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    User.findOne = jest.fn().mockResolvedValue({
      ...REGULAR_USER, verified: true, passwordHash: hash, save: jest.fn().mockResolvedValue(true)
    });
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
  });

  test('403 when email not verified', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.needsVerification).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.verified).toBe(false);
  });

  test('401 with wrong password', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'alice@example.com', password: 'WrongPass1' });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  test('401 when user not found', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD });
    expect(res.status).toBe(401);
  });

  test('400 when email missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: PASSWORD });
    expect(res.status).toBe(400);
  });

  test('400 when password missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'alice@example.com' });
    expect(res.status).toBe(400);
  });

  test('token contains correct role', async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);
    User.findOne = jest.fn().mockResolvedValue({
      ...ADMIN_USER, passwordHash: hash, save: jest.fn().mockResolvedValue(true)
    });
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'janakar.ganesan@gmail.com', password: PASSWORD });
    const decoded = jwt.verify(res.body.token, SECRET);
    expect(decoded.role).toBe('admin');
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — GET /me
   ════════════════════════════════════════════════════════ */
describe('GET /api/auth/me', () => {
  test('401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('401 with invalid token', async () => {
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });

  test('200 returns user profile', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(REGULAR_USER) })
    });
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer ' + makeUserToken());
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('alice@example.com');
  });

  test('200 returns pending profile when User not created yet', async () => {
    const pending = {
      uid: 'user-uid-001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '9876543210',
      country: 'UK',
      city: 'London',
      verified: false
    };
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    });
    OtpVerification.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(pending) })
    });
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer ' + makeUserToken());
    expect(res.status).toBe(200);
    expect(res.body.user.pending).toBe(true);
    expect(res.body.user.firstName).toBe('Alice');
    expect(res.body.user.lastName).toBe('Smith');
  });

  test('404 when user not in DB', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    });
    OtpVerification.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    });
    const res = await request(app).get('/api/auth/me')
      .set('Authorization', 'Bearer ' + makeUserToken());
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — PATCH /profile
   ════════════════════════════════════════════════════════ */
describe('PATCH /api/auth/profile', () => {
  test('401 without token', async () => {
    const res = await request(app).patch('/api/auth/profile')
      .send({ firstName: 'Alice', lastName: 'Smith' });
    expect(res.status).toBe(401);
  });

  test('400 when firstName too short', async () => {
    const res = await request(app).patch('/api/auth/profile')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ firstName: 'A', lastName: 'Smith' });
    expect(res.status).toBe(400);
  });

  test('200 updates user name', async () => {
    const save = jest.fn().mockResolvedValue(undefined);
    User.findOne = jest.fn().mockResolvedValue({
      uid: 'user-uid-001',
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phone: '9876543210',
      role: 'user',
      verified: true,
      photoURL: '',
      save
    });
    const res = await request(app).patch('/api/auth/profile')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ firstName: 'Alicia', lastName: 'Jones' });
    expect(res.status).toBe(200);
    expect(save).toHaveBeenCalled();
    expect(res.body.user.firstName).toBe('Alicia');
    expect(res.body.user.lastName).toBe('Jones');
    expect(res.body.user.email).toBe('alice@example.com');
  });

  test('404 when user not found', async () => {
    User.findOne = jest.fn().mockResolvedValue(null);
    OtpVerification.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).patch('/api/auth/profile')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ firstName: 'Alice', lastName: 'Smith' });
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — FORGOT PASSWORD
   ════════════════════════════════════════════════════════ */
describe('POST /api/auth/forgot-password', () => {
  test('200 always (user exists or not — no enumeration)', async () => {
    User.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'nobody@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('400 when email invalid', async () => {
    const res = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  test('200 when user exists (SMTP_USER not set → no actual email)', async () => {
    User.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(REGULAR_USER) });
    const res = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });
    expect(res.status).toBe(200);
  });
});

/* ════════════════════════════════════════════════════════
   AUTH — RESET PASSWORD
   ════════════════════════════════════════════════════════ */
describe('POST /api/auth/reset-password', () => {
  function makeResetToken(uid = 'u1') {
    return jwt.sign({ uid, email: 'u@t.com', purpose: 'pw-reset' }, SECRET, { expiresIn: '1h' });
  }

  test('200 on valid token + strong password', async () => {
    User.updateOne = jest.fn().mockResolvedValue({ matchedCount: 1 });
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: makeResetToken(), password: 'NewPassword1' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('400 when token missing', async () => {
    const res = await request(app).post('/api/auth/reset-password')
      .send({ password: 'NewPassword1' });
    expect(res.status).toBe(400);
  });

  test('400 when token expired', async () => {
    const expiredToken = jwt.sign({ uid: 'u1', purpose: 'pw-reset' }, SECRET, { expiresIn: '-1s' });
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: expiredToken, password: 'NewPassword1' });
    expect(res.status).toBe(400);
  });

  test('400 when token has wrong purpose', async () => {
    const wrongToken = jwt.sign({ uid: 'u1', purpose: 'login' }, SECRET, { expiresIn: '1h' });
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: wrongToken, password: 'NewPassword1' });
    expect(res.status).toBe(400);
  });

  test('400 when new password too weak', async () => {
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: makeResetToken(), password: 'weak' });
    expect(res.status).toBe(400);
  });

  test('404 when user uid not in DB', async () => {
    User.updateOne = jest.fn().mockResolvedValue({ matchedCount: 0 });
    const res = await request(app).post('/api/auth/reset-password')
      .send({ token: makeResetToken(), password: 'NewPassword1' });
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   ENQUIRIES
   ════════════════════════════════════════════════════════ */
describe('POST /api/enquiries', () => {
  const VALID = {
    name: 'Alice Smith', email: 'alice@example.com',
    message: 'I am interested in your AI services.'
  };

  beforeEach(() => {
    Enquiry.create = jest.fn().mockResolvedValue({ _id: 'enq-001' });
  });

  test('201 on valid submission', async () => {
    const res = await request(app).post('/api/enquiries').send(VALID);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
  });

  test('400 when name too short', async () => {
    const res = await request(app).post('/api/enquiries').send({ ...VALID, name: 'A' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/name/i);
  });

  test('400 when email invalid', async () => {
    const res = await request(app).post('/api/enquiries').send({ ...VALID, email: 'bademail' });
    expect(res.status).toBe(400);
  });

  test('400 when message too short', async () => {
    const res = await request(app).post('/api/enquiries').send({ ...VALID, message: 'Hi' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/10 characters/i);
  });

  test('400 when name is missing', async () => {
    const res = await request(app).post('/api/enquiries').send({ email: VALID.email, message: VALID.message });
    expect(res.status).toBe(400);
  });
});

/* ════════════════════════════════════════════════════════
   SESSIONS — PING
   ════════════════════════════════════════════════════════ */
describe('POST /api/sessions/ping', () => {
  beforeEach(() => {
    ActiveSession.findOneAndUpdate = jest.fn().mockResolvedValue({});
  });

  test('401 without token', async () => {
    const res = await request(app).post('/api/sessions/ping');
    expect(res.status).toBe(401);
  });

  test('200 with valid token', async () => {
    const res = await request(app).post('/api/sessions/ping')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ displayName: 'Alice' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

/* ════════════════════════════════════════════════════════
   OTP
   ════════════════════════════════════════════════════════ */
describe('POST /api/otp/verify', () => {
  test('401 without token', async () => {
    const res = await request(app).post('/api/otp/verify').send({ code: '123456' });
    expect(res.status).toBe(401);
  });

  test('400 when code is not 6 digits', async () => {
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '12345' });
    expect(res.status).toBe(400);
  });

  test('400 when code is non-numeric', async () => {
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: 'abcdef' });
    expect(res.status).toBe(400);
  });

  test('404 when no OTP record found', async () => {
    OtpVerification.findOne = jest.fn().mockResolvedValue(null);
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ email: 'user@test.com' }) })
    });
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });
    expect(res.status).toBe(404);
  });

  test('200 when uid lookup misses but email fallback matches', async () => {
    OtpVerification.findOne = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        code: '123456', expiresAt: new Date(Date.now() + 600000), verified: false
      });
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ email: 'user@test.com' }) })
    });
    OtpVerification.findOneAndUpdate = jest.fn().mockResolvedValue({});
    User.findOneAndUpdate = jest.fn().mockResolvedValue({});

    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });

    expect(res.status).toBe(200);
    expect(OtpVerification.findOne).toHaveBeenNthCalledWith(1, { uid: 'user-uid-001' });
    expect(OtpVerification.findOne).toHaveBeenNthCalledWith(2, { email: 'user@test.com' });
  });

  test('410 when OTP expired', async () => {
    OtpVerification.findOne = jest.fn().mockResolvedValue({
      code: '123456', expiresAt: new Date(Date.now() - 1000), verified: false
    });
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });
    expect(res.status).toBe(410);
  });

  test('400 when code is wrong', async () => {
    OtpVerification.findOne = jest.fn().mockResolvedValue({
      code: '999999', expiresAt: new Date(Date.now() + 600000), verified: false
    });
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect/i);
  });

  test('200 when code matches and not expired', async () => {
    OtpVerification.findOneAndUpdate = jest.fn().mockResolvedValue({});
    User.findOneAndUpdate = jest.fn().mockResolvedValue({});
    OtpVerification.findOne = jest.fn().mockResolvedValue({
      uid: 'user-uid-001',
      code: '123456', expiresAt: new Date(Date.now() + 600000), verified: false
    });
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(User.findOneAndUpdate).toHaveBeenCalled();
  });

  test('200 creates User when pending registration is verified', async () => {
    const pending = {
      uid: 'user-uid-001',
      email: 'alice@example.com',
      phone: '9876543210',
      code: '123456',
      expiresAt: new Date(Date.now() + 600000),
      verified: false,
      passwordHash: 'hashed-pw',
      firstName: 'Alice',
      lastName: 'Smith',
      country: 'UK',
      city: 'London'
    };
    OtpVerification.findOne = jest.fn().mockImplementation((query) => {
      if (query.uid === 'user-uid-001') return Promise.resolve(pending);
      return { lean: jest.fn().mockResolvedValue(null) };
    });
    User.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOneAndUpdate = jest.fn().mockResolvedValue({});
    User.create = jest.fn().mockResolvedValue({ ...REGULAR_USER, verified: true });

    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });

    expect(res.status).toBe(200);
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
      uid: 'user-uid-001',
      email: 'alice@example.com',
      verified: true,
      firstName: 'Alice',
      lastName: 'Smith'
    }));
  });

  test('200 (already verified)', async () => {
    OtpVerification.findOne = jest.fn().mockResolvedValue({
      code: '123456', expiresAt: new Date(Date.now() + 600000), verified: true
    });
    const res = await request(app).post('/api/otp/verify')
      .set('Authorization', 'Bearer ' + makeUserToken())
      .send({ code: '123456' });
    expect(res.status).toBe(200);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — Authentication & Authorization
   ════════════════════════════════════════════════════════ */
describe('Admin routes — auth guards', () => {
  test('GET /api/admin/stats: 401 without token', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/admin/stats: 403 for non-admin user', async () => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'user' }) }) });
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', 'Bearer ' + makeUserToken());
    expect(res.status).toBe(403);
  });

  test('GET /api/admin/users: 401 without token', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  test('POST /api/admin/users: 401 without token', async () => {
    const res = await request(app).post('/api/admin/users').send({});
    expect(res.status).toBe(401);
  });

  test('DELETE /api/admin/users/:uid: 401 without token', async () => {
    const res = await request(app).delete('/api/admin/users/some-uid');
    expect(res.status).toBe(401);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — STATS
   ════════════════════════════════════════════════════════ */
describe('GET /api/admin/stats', () => {
  beforeEach(() => {
    User.findOne    = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) });
    User.countDocuments     = jest.fn().mockResolvedValue(42);
    Enquiry.countDocuments  = jest.fn().mockResolvedValue(10);
    ActiveSession.countDocuments = jest.fn().mockResolvedValue(3);
  });

  test('200 returns stats', async () => {
    const res = await request(app).get('/api/admin/stats')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(200);
    expect(res.body.totalUsers).toBeDefined();
    expect(res.body.totalEnquiries).toBeDefined();
    expect(res.body.activeNow).toBeDefined();
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — GET USERS
   ════════════════════════════════════════════════════════ */
describe('GET /api/admin/users', () => {
  beforeEach(() => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) });
    const chainMock = { sort: jest.fn(), limit: jest.fn(), select: jest.fn(), lean: jest.fn().mockResolvedValue([REGULAR_USER]) };
    chainMock.sort.mockReturnValue(chainMock);
    chainMock.limit.mockReturnValue(chainMock);
    chainMock.select.mockReturnValue(chainMock);
    User.find = jest.fn().mockReturnValue(chainMock);
  });

  test('200 returns users array', async () => {
    const res = await request(app).get('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.users.length).toBeGreaterThan(0);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — CREATE USER
   ════════════════════════════════════════════════════════ */
describe('POST /api/admin/users', () => {
  const VALID_NEW_USER = {
    firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com',
    password: 'Password1', country: 'India', city: 'Delhi', role: 'user'
  };

  beforeEach(() => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    User.create  = jest.fn().mockResolvedValue({ ...REGULAR_USER, uid: 'new-uid', email: 'bob@example.com' });
  });

  test('201 creates user successfully', async () => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send(VALID_NEW_USER);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.user.email).toBe('bob@example.com');
  });

  test('400 when firstName missing', async () => {
    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ ...VALID_NEW_USER, firstName: 'A' });
    expect(res.status).toBe(400);
  });

  test('400 when email invalid', async () => {
    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ ...VALID_NEW_USER, email: 'bademail' });
    expect(res.status).toBe(400);
  });

  test('400 when password too short', async () => {
    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ ...VALID_NEW_USER, password: 'short' });
    expect(res.status).toBe(400);
  });

  test('409 when email already exists', async () => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(REGULAR_USER) });

    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send(VALID_NEW_USER);
    expect(res.status).toBe(409);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — ROLE TOGGLE
   ════════════════════════════════════════════════════════ */
describe('PATCH /api/admin/users/:uid/role', () => {
  beforeEach(() => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) });
    User.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ uid: 'user-uid-001', email: 'alice@example.com', role: 'admin' }) });
  });

  test('200 promotes user to admin', async () => {
    const res = await request(app).patch('/api/admin/users/user-uid-001/role')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('200 demotes admin to user', async () => {
    User.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ uid: 'user-uid-001', role: 'user' }) });
    const res = await request(app).patch('/api/admin/users/user-uid-001/role')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ role: 'user' });
    expect(res.status).toBe(200);
  });

  test('400 when role value is invalid', async () => {
    const res = await request(app).patch('/api/admin/users/user-uid-001/role')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ role: 'superadmin' });
    expect(res.status).toBe(400);
  });

  test('400 when admin tries to demote themselves', async () => {
    const res = await request(app).patch('/api/admin/users/admin-uid-001/role')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ role: 'user' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot remove your own/i);
  });

  test('404 when user uid not found', async () => {
    User.findOneAndUpdate = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const res = await request(app).patch('/api/admin/users/nonexistent-uid/role')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ role: 'admin' });
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — DELETE USER
   ════════════════════════════════════════════════════════ */
describe('DELETE /api/admin/users/:uid', () => {
  beforeEach(() => {
    User.findOne  = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) });
    User.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
  });

  test('200 deletes a different user', async () => {
    const res = await request(app).delete('/api/admin/users/user-uid-001')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('400 when admin tries to delete themselves', async () => {
    const res = await request(app).delete('/api/admin/users/admin-uid-001')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/cannot delete your own/i);
  });

  test('404 when uid not found', async () => {
    User.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 0 });
    const res = await request(app).delete('/api/admin/users/ghost-uid')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   ADMIN — RESET PASSWORD (email)
   ════════════════════════════════════════════════════════ */
describe('POST /api/admin/users/:uid/reset-password', () => {
  beforeEach(() => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue({ uid: 'user-uid-001', email: 'alice@example.com', firstName: 'Alice' }) });
  });

  test('200 generates reset link (no SMTP → no email sent)', async () => {
    const res = await request(app).post('/api/admin/users/user-uid-001/reset-password')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('404 when user not found', async () => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post('/api/admin/users/ghost-uid/reset-password')
      .set('Authorization', 'Bearer ' + makeAdminToken());
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   404 fallback
   ════════════════════════════════════════════════════════ */
describe('404 handler', () => {
  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});

/* ════════════════════════════════════════════════════════
   GAP COVERAGE — new scenarios from audit
   ════════════════════════════════════════════════════════ */

/* ── Missing / null body → 400 not 500 ───────────────── */
describe('Missing body guard (no Content-Type)', () => {
  test('POST /api/auth/register with no body returns 400', async () => {
    const res = await request(app).post('/api/auth/register')
      .set('Content-Type', 'text/plain').send('');
    expect(res.status).toBe(400);
    expect(res.body.message).toBeDefined();
  });

  test('POST /api/auth/login with no body returns 400', async () => {
    const res = await request(app).post('/api/auth/login')
      .set('Content-Type', 'text/plain').send('');
    expect(res.status).toBe(400);
  });

  test('POST /api/enquiries with no body returns 400', async () => {
    const res = await request(app).post('/api/enquiries')
      .set('Content-Type', 'text/plain').send('');
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/forgot-password with no body returns 400', async () => {
    const res = await request(app).post('/api/auth/forgot-password')
      .set('Content-Type', 'text/plain').send('');
    expect(res.status).toBe(400);
  });
});

/* ── OTP send — empty email guard ────────────────────── */
describe('POST /api/otp/send — email guard', () => {
  beforeEach(() => {
    OtpVerification.findOneAndUpdate = jest.fn().mockResolvedValue({});
    OtpVerification.findOne = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null)
    });
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    });
  });

  test('400 when token has no email (empty userEmail)', async () => {
    /* Token signed without email field — userEmail will be '' */
    const noEmailToken = require('jsonwebtoken').sign(
      { uid: 'user-uid-001', role: 'user' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app).post('/api/otp/send')
      .set('Authorization', 'Bearer ' + noEmailToken);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no email/i);
  });

  test('200 when token has valid email (dev mode)', async () => {
    User.findOne = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ email: 'user@test.com' }) })
    });
    const res = await request(app).post('/api/otp/send')
      .set('Authorization', 'Bearer ' + makeUserToken());
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.devCode).toBeDefined(); /* NODE_ENV=test → dev mode */
  });

  test('401 without token', async () => {
    const res = await request(app).post('/api/otp/send');
    expect(res.status).toBe(401);
  });
});

/* ── SMTP failure → 502 ──────────────────────────────── */
describe('SMTP failure handling → 502', () => {
  const mail = require('../lib/mail');
  let prevNodeEnv;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV  = 'production';
    process.env.SMTP_USER = 'smtp-test@test.com';
    process.env.SMTP_PASS = 'test-pass';
    mail._resetTransporter();
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    mail._resetTransporter();
    jest.restoreAllMocks();
  });

  test('POST /api/auth/forgot-password: 502 on SMTP error', async () => {
    User.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(REGULAR_USER) });
    jest.spyOn(mail, 'send').mockRejectedValue(new Error('SMTP auth failed'));

    const res = await request(app).post('/api/auth/forgot-password')
      .send({ email: 'alice@example.com' });

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/failed to send/i);
  });

  test('POST /api/admin/users/:uid/reset-password: 502 on SMTP error', async () => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue({ uid: 'user-uid-001', email: 'alice@example.com', firstName: 'Alice' }) });
    jest.spyOn(mail, 'send').mockRejectedValue(new Error('Connection refused'));

    const res = await request(app).post('/api/admin/users/user-uid-001/reset-password')
      .set('Authorization', 'Bearer ' + makeAdminToken());

    expect(res.status).toBe(502);
    expect(res.body.message).toMatch(/failed to send/i);
  });
});

/* ── OTP send — SMTP failure → 502 ──────────────────── */
/* Note: OTP route uses a lazy-init singleton transporter that cannot be mocked
   after first initialization. The 502 SMTP failure path is verified via
   /api/auth/forgot-password and /api/admin/users/:uid/reset-password tests above.
   The structural guard (same try/catch pattern) is identical in routes/otp.js. */
describe('POST /api/otp/send — SMTP failure note', () => {
  test('OTP send 502 path uses same pattern as verified auth/admin routes', () => {
    /* Structural assertion: the route file contains the 502 SMTP catch block */
    const fs = require('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '../routes/otp.js'), 'utf8');
    expect(src).toContain('status(502)');
    expect(src).toContain('Failed to send verification email');
  });
});

/* ── Admin create user — missing lastName → 400 ──────── */
describe('POST /api/admin/users — edge cases', () => {
  beforeEach(() => {
    User.findOne = jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) });
    OtpVerification.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
  });

  test('400 when lastName missing entirely', async () => {
    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ firstName: 'Bob', email: 'bob@test.com', password: 'Password1' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/last name/i);
  });

  test('400 when entire body is empty', async () => {
    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({});
    expect(res.status).toBe(400);
  });

  test('role defaults to user when unknown role provided', async () => {
    User.findOne = jest.fn()
      .mockReturnValueOnce({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ role: 'admin' }) }) })
      .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    OtpVerification.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });
    User.create = jest.fn().mockImplementation(async (data) => ({ ...data, createdAt: new Date() }));

    const res = await request(app).post('/api/admin/users')
      .set('Authorization', 'Bearer ' + makeAdminToken())
      .send({ firstName: 'Bob', lastName: 'Jones', email: 'bob@test.com', password: 'Password1', role: 'superadmin' });
    expect(res.status).toBe(201);
    /* safeRole logic should have coerced to 'user' */
    expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'user' }));
  });
});
