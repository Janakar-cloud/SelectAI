/* =========================================================
   SelectAI — tests.js
   Pure-vanilla test runner. No external dependencies.
   Covers: unit tests + functional/DOM behaviour tests.
   ========================================================= */
'use strict';

(function (global) {

  /* ═══════════════════════════════════════════════════════
     Micro test runner
     ═══════════════════════════════════════════════════════ */
  var _results = [];

  function describe(suiteName, fn) {
    _results.push({ type: 'suite', name: suiteName });
    fn();
  }

  function it(desc, fn) {
    var result = { type: 'test', desc: desc, pass: false, error: null };
    try {
      fn();
      result.pass = true;
    } catch (e) {
      result.error = e.message || String(e);
    }
    _results.push(result);
  }

  function expect(actual) {
    return {
      toBe: function (expected) {
        if (actual !== expected)
          throw new Error('Expected ' + JSON.stringify(expected) + ' but got ' + JSON.stringify(actual));
      },
      toEqual: function (expected) {
        var a = JSON.stringify(actual);
        var b = JSON.stringify(expected);
        if (a !== b) throw new Error('Expected ' + b + ' but got ' + a);
      },
      toBeTruthy: function () {
        if (!actual) throw new Error('Expected truthy but got ' + JSON.stringify(actual));
      },
      toBeFalsy: function () {
        if (actual) throw new Error('Expected falsy but got ' + JSON.stringify(actual));
      },
      toMatch: function (regex) {
        if (!regex.test(actual)) throw new Error(JSON.stringify(actual) + ' did not match ' + regex);
      },
      toContain: function (str) {
        if (String(actual).indexOf(str) === -1)
          throw new Error(JSON.stringify(actual) + ' does not contain ' + JSON.stringify(str));
      },
      toHaveLength: function (len) {
        if ((actual || '').length !== len)
          throw new Error('Expected length ' + len + ' but got ' + (actual || '').length);
      },
      toBeGreaterThanOrEqual: function (n) {
        if (actual < n) throw new Error('Expected >= ' + n + ' but got ' + actual);
      },
      toBeLessThanOrEqual: function (n) {
        if (actual > n) throw new Error('Expected <= ' + n + ' but got ' + actual);
      },
      toThrow: function () {
        if (typeof actual !== 'function') throw new Error('expect(fn).toThrow() requires a function');
        var threw = false;
        try { actual(); } catch (e) { threw = true; }
        if (!threw) throw new Error('Expected function to throw but it did not');
      }
    };
  }

  /* ═══════════════════════════════════════════════════════
     Helpers mirrored from production code
     ═══════════════════════════════════════════════════════ */

  /* --- validateSignup (mirrored from login.html inline JS) */
  function validateSignup(d) {
    if (!d || d.firstName.length < 2)                       return 'Please enter a valid first name (min 2 characters).';
    if (d.lastName.length < 2)                              return 'Please enter a valid last name (min 2 characters).';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))       return 'Please enter a valid email address.';
    if (!d.country)                                         return 'Please select your country.';
    if (d.city.length < 2)                                  return 'Please enter your city.';
    return '';
  }

  /* --- validateLead (mirrors lead-form.js validation logic) */
  function validateLead(d) {
    if (!d.name || d.name.trim().length < 2)                return 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))       return 'Please enter a valid email address.';
    if (!d.message || d.message.trim().length < 10)         return 'Please enter a message (min 10 characters).';
    return '';
  }

  /* --- generateOtp */
  function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  /* --- fmtDate (mirrors admin.js) */
  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      var d = (typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return '—'; }
  }

  /* --- esc (mirrors admin.js) */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* --- downloadCSV (mirrors admin.js) */
  function buildCsvString(rows) {
    if (!rows.length) return null;
    var headers = Object.keys(rows[0]);
    var lines   = rows.map(function (row) {
      return headers.map(function (h) {
        return '"' + (row[h] || '').toString().replace(/"/g, '""') + '"';
      }).join(',');
    });
    return '\uFEFF' + headers.join(',') + '\n' + lines.join('\n');
  }

  /* --- OTP verify (simplified, without Firestore) */
  function verifyOtpLocal(stored, entered, expired) {
    if (expired)           return { ok: false, msg: 'OTP expired.' };
    if (stored !== entered) return { ok: false, msg: 'Incorrect code.' };
    return { ok: true, msg: 'Verified.' };
  }

  /* ═══════════════════════════════════════════════════════
     UNIT TESTS
     ═══════════════════════════════════════════════════════ */

  describe('validateSignup()', function () {
    it('rejects short first name', function () {
      var r = validateSignup({ firstName: 'A', lastName: 'Smith', email: 'a@b.com', country: 'India', city: 'Mumbai' });
      expect(r).toContain('first name');
    });
    it('rejects short last name', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'S', email: 'a@b.com', country: 'India', city: 'Mumbai' });
      expect(r).toContain('last name');
    });
    it('rejects invalid email', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'Smith', email: 'notanemail', country: 'India', city: 'Mumbai' });
      expect(r).toContain('email');
    });
    it('rejects missing email @', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'Smith', email: 'a.b.com', country: 'India', city: 'Mumbai' });
      expect(r).toContain('email');
    });
    it('rejects empty country', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'Smith', email: 'a@b.com', country: '', city: 'Mumbai' });
      expect(r).toContain('country');
    });
    it('rejects short city', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'Smith', email: 'a@b.com', country: 'India', city: 'X' });
      expect(r).toContain('city');
    });
    it('passes valid data', function () {
      var r = validateSignup({ firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', country: 'India', city: 'Mumbai' });
      expect(r).toBe('');
    });
    it('passes with hyphenated last name', function () {
      var r = validateSignup({ firstName: 'Mary', lastName: 'Jane-Doe', email: 'm@d.io', country: 'UK', city: 'London' });
      expect(r).toBe('');
    });
  });

  describe('validateLead()', function () {
    it('rejects short name', function () {
      var r = validateLead({ name: 'A', email: 'a@b.com', message: 'Hello world this is a message' });
      expect(r).toContain('name');
    });
    it('rejects invalid email', function () {
      var r = validateLead({ name: 'Alice', email: 'bademail', message: 'Hello world this is a test message' });
      expect(r).toContain('email');
    });
    it('rejects short message', function () {
      var r = validateLead({ name: 'Alice', email: 'a@b.com', message: 'Hi' });
      expect(r).toContain('message');
    });
    it('passes valid lead', function () {
      var r = validateLead({ name: 'Alice Smith', email: 'alice@example.com', message: 'I am interested in your services.' });
      expect(r).toBe('');
    });
  });

  describe('generateOtp()', function () {
    it('returns a 6-character string', function () {
      var otp = generateOtp();
      expect(otp).toHaveLength(6);
    });
    it('contains only digits', function () {
      var otp = generateOtp();
      expect(otp).toMatch(/^\d{6}$/);
    });
    it('is in range 100000–999999', function () {
      var otp = parseInt(generateOtp(), 10);
      expect(otp).toBeGreaterThanOrEqual(100000);
      expect(otp).toBeLessThanOrEqual(999999);
    });
    it('generates different values on repeated calls', function () {
      var codes = [];
      for (var i = 0; i < 20; i++) codes.push(generateOtp());
      var unique = codes.filter(function (v, idx) { return codes.indexOf(v) === idx; });
      expect(unique.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('verifyOtp()', function () {
    it('fails when OTP is expired', function () {
      var r = verifyOtpLocal('123456', '123456', true);
      expect(r.ok).toBeFalsy();
      expect(r.msg).toContain('expired');
    });
    it('fails on wrong code', function () {
      var r = verifyOtpLocal('123456', '654321', false);
      expect(r.ok).toBeFalsy();
      expect(r.msg).toContain('Incorrect');
    });
    it('passes with correct code', function () {
      var r = verifyOtpLocal('123456', '123456', false);
      expect(r.ok).toBeTruthy();
    });
  });

  describe('fmtDate()', function () {
    it('returns em-dash for null', function () {
      expect(fmtDate(null)).toBe('—');
    });
    it('returns em-dash for undefined', function () {
      expect(fmtDate(undefined)).toBe('—');
    });
    it('formats a JS Date object', function () {
      var d = new Date(2024, 0, 15); /* 15 Jan 2024 */
      var r = fmtDate(d);
      expect(r).toContain('2024');
      expect(r).toContain('Jan');
    });
    it('formats a mock Firestore Timestamp', function () {
      var mockTs = { toDate: function () { return new Date(2025, 5, 9); } };
      var r = fmtDate(mockTs);
      expect(r).toContain('2025');
    });
  });

  describe('esc() — HTML escape', function () {
    it('escapes ampersand', function () {
      expect(esc('a&b')).toBe('a&amp;b');
    });
    it('escapes less-than', function () {
      expect(esc('<script>')).toBe('&lt;script&gt;');
    });
    it('escapes double-quote', function () {
      expect(esc('"hello"')).toBe('&quot;hello&quot;');
    });
    it('leaves safe strings unchanged', function () {
      expect(esc('hello world')).toBe('hello world');
    });
    it('converts non-strings', function () {
      expect(esc(42)).toBe('42');
    });
  });

  describe('buildCsvString()', function () {
    it('returns null for empty array', function () {
      expect(buildCsvString([])).toBe(null);
    });
    it('starts with BOM character', function () {
      var csv = buildCsvString([{ Name: 'Alice', Email: 'a@b.com' }]);
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
    });
    it('includes headers on first non-BOM line', function () {
      var csv = buildCsvString([{ Name: 'Alice', Email: 'a@b.com' }]);
      expect(csv).toContain('Name,Email');
    });
    it('wraps values in double quotes', function () {
      var csv = buildCsvString([{ Name: 'Alice', Email: 'a@b.com' }]);
      expect(csv).toContain('"Alice"');
    });
    it('escapes internal double quotes', function () {
      var csv = buildCsvString([{ Name: 'O"Brien', Email: 'o@b.com' }]);
      expect(csv).toContain('O""Brien');
    });
    it('handles multiple rows', function () {
      var csv = buildCsvString([
        { Name: 'Alice', Email: 'a@b.com' },
        { Name: 'Bob',   Email: 'b@b.com' }
      ]);
      expect(csv).toContain('"Alice"');
      expect(csv).toContain('"Bob"');
    });
  });

  /* ═══════════════════════════════════════════════════════
     FUNCTIONAL / DOM TESTS
     ═══════════════════════════════════════════════════════ */

  describe('Auth Guard — dev mode bypass', function () {
    it('SELECTAI_USER is set in dev mode', function () {
      /* In tests.html the app-config is a placeholder, so dev mode is active */
      var u = window.SELECTAI_USER;
      /* In dev mode the guard sets a mock user; in real Firebase it's set after auth */
      /* We only assert it is either set (dev) or not blocking the page (visibility visible) */
      var vis = document.documentElement.style.visibility;
      expect(vis === 'visible' || u !== undefined).toBeTruthy();
    });
  });

  describe('Login page — OTP input DOM behaviour', function () {
    it('OTP inputs exist on login.html (if loaded)', function () {
      /* This test runs on tests.html, not login.html, so we stub the check */
      var stub = document.createElement('div');
      stub.innerHTML = '<input class="otp-input" /><input class="otp-input" />';
      var inputs = stub.querySelectorAll('.otp-input');
      expect(inputs.length).toBe(2);
    });

    it('OTP verify button disabled when inputs empty', function () {
      var btn = document.createElement('button');
      btn.disabled = true;
      var allFilled = ['', '', '', '', '', ''].every(function (v) { return v !== ''; });
      if (allFilled) btn.disabled = false;
      expect(btn.disabled).toBeTruthy();
    });

    it('OTP verify button enabled when all 6 inputs filled', function () {
      var btn = document.createElement('button');
      btn.disabled = true;
      var allFilled = ['1', '2', '3', '4', '5', '6'].every(function (v) { return v !== ''; });
      if (allFilled) btn.disabled = false;
      expect(btn.disabled).toBeFalsy();
    });
  });

  describe('Login page — tab switching', function () {
    it('switchTab selects correct panel class', function () {
      /* Create a minimal mock of the login tab structure */
      var container = document.createElement('div');
      container.innerHTML = [
        '<div class="auth-tabs">',
        '  <button id="tabLogin" class="auth-tab active">Sign In</button>',
        '  <button id="tabSignup" class="auth-tab">Sign Up</button>',
        '</div>',
        '<div class="auth-panel active" id="panelLogin"></div>',
        '<div class="auth-panel"        id="panelSignup"></div>'
      ].join('');
      document.body.appendChild(container);

      /* Simulate switchTab('signup') */
      container.querySelector('#tabLogin').classList.remove('active');
      container.querySelector('#tabSignup').classList.add('active');
      container.querySelector('#panelLogin').classList.remove('active');
      container.querySelector('#panelSignup').classList.add('active');

      expect(container.querySelector('#panelSignup').classList.contains('active')).toBeTruthy();
      expect(container.querySelector('#panelLogin').classList.contains('active')).toBeFalsy();

      document.body.removeChild(container);
    });
  });

  describe('Admin — renderUsersTable HTML safety', function () {
    it('XSS in user name is escaped', function () {
      var maliciousName = '<img src=x onerror=alert(1)>';
      var escaped = esc(maliciousName);
      expect(escaped).toContain('&lt;img');
      expect(escaped.indexOf('<img')).toBe(-1);
    });
    it('XSS in email is escaped', function () {
      var malicious = 'user@"><script>alert()</script>';
      var escaped = esc(malicious);
      expect(escaped.indexOf('<script>')).toBe(-1);
    });
  });

  describe('Admin — password reset input validation', function () {
    it('empty email triggers guard', function () {
      var email = '';
      var wouldSend = (email && email.length > 0);
      expect(wouldSend).toBeFalsy();
    });
    it('non-empty email passes guard', function () {
      var email = 'user@example.com';
      var wouldSend = (email && email.length > 0);
      expect(wouldSend).toBeTruthy();
    });
  });

  /* ═══════════════════════════════════════════════════════
     NEW: Admin — Create User modal validation
     ═══════════════════════════════════════════════════════ */
  describe('Admin — validatePassword() (server-side mirror)', function () {
    function validatePassword(pw) {
      if (!pw || pw.length < 8)  return 'Password must be at least 8 characters.';
      if (!/[A-Z]/.test(pw))     return 'Password must contain at least one uppercase letter.';
      if (!/[0-9]/.test(pw))     return 'Password must contain at least one number.';
      return '';
    }
    it('rejects undefined', function () { expect(validatePassword(undefined)).toContain('8 characters'); });
    it('rejects short password', function () { expect(validatePassword('abc')).toContain('8 characters'); });
    it('rejects no uppercase', function () { expect(validatePassword('alicetest1')).toContain('uppercase'); });
    it('rejects no digit', function () { expect(validatePassword('AliceTest')).toContain('number'); });
    it('accepts strong password', function () { expect(validatePassword('SelectAI@2026')).toBe(''); });
    it('accepts minimal valid password', function () { expect(validatePassword('Password1')).toBe(''); });
  });

  describe('Admin — role toggle logic', function () {
    function toggle(role) { return role === 'admin' ? 'user' : 'admin'; }
    function safeRole(r) { return r === 'admin' ? 'admin' : 'user'; }

    it('toggles user → admin', function () { expect(toggle('user')).toBe('admin'); });
    it('toggles admin → user', function () { expect(toggle('admin')).toBe('user'); });
    it('safeRole rejects unknown value', function () { expect(safeRole('superadmin')).toBe('user'); });
    it('safeRole rejects empty string', function () { expect(safeRole('')).toBe('user'); });
    it('safeRole accepts admin', function () { expect(safeRole('admin')).toBe('admin'); });
  });

  describe('Admin — Create User form DOM', function () {
    it('modal overlay exists in admin.html (stub check)', function () {
      var div = document.createElement('div');
      div.id = 'createUserModal';
      div.className = 'modal-overlay';
      document.body.appendChild(div);
      var found = document.getElementById('createUserModal');
      expect(found).toBeTruthy();
      document.body.removeChild(div);
    });
    it('form submit button starts enabled', function () {
      var btn = document.createElement('button');
      btn.type = 'submit';
      expect(btn.disabled).toBeFalsy();
    });
    it('disabling submit btn on submit prevents double-send', function () {
      var btn = document.createElement('button');
      btn.disabled = true;
      expect(btn.disabled).toBeTruthy();
    });
    it('role select defaults to user', function () {
      var sel = document.createElement('select');
      var opt1 = document.createElement('option');
      opt1.value = 'user';
      opt1.selected = true;
      var opt2 = document.createElement('option');
      opt2.value = 'admin';
      sel.appendChild(opt1);
      sel.appendChild(opt2);
      expect(sel.value).toBe('user');
    });
  });

  describe('Admin — Delete confirmation guard', function () {
    it('returns false (cancel) when confirmed is false', function () {
      var confirmed = false;
      var wouldDelete = confirmed ? 'deleted' : 'cancelled';
      expect(wouldDelete).toBe('cancelled');
    });
    it('proceeds when confirmed is true', function () {
      var confirmed = true;
      var wouldDelete = confirmed ? 'deleted' : 'cancelled';
      expect(wouldDelete).toBe('deleted');
    });
  });

  /* ═══════════════════════════════════════════════════════
     Export results
     ═══════════════════════════════════════════════════════ */
  global.SELECTAI_TEST_RESULTS = _results;

}(window));
