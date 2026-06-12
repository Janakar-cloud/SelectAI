'use strict';
const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest-at-least-32-chars-long';

function makeToken(uid, email, role = 'user') {
  return jwt.sign({ uid, email, role }, SECRET, { expiresIn: '1h' });
}

function makeAdminToken() {
  return makeToken('admin-uid-001', 'admin@test.com', 'admin');
}

function makeUserToken() {
  return makeToken('user-uid-001', 'user@test.com', 'user');
}

module.exports = { makeToken, makeAdminToken, makeUserToken };
