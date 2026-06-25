/* =========================================================
   SelectAI — api.js  v20260609d
   Centralised API client for all backend calls.
   Reads JWT from localStorage('selectai_token').
   ========================================================= */
'use strict';

(function (global) {

  var TOKEN_KEY = 'selectai_token';

  /* Get stored JWT, or null if not present */
  function _getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  /* Save token returned after login / register */
  function _setToken(t) {
    try { if (t) localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
  }

  /* Clear token on sign-out */
  function _clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
  }

  /**
   * Core fetch wrapper.
   * @param {string}  path     - API path, e.g. '/api/admin/users'
   * @param {object}  opts     - fetch options
   * @param {boolean} withAuth - attach Bearer token (default: true)
   */
  function request(path, opts, withAuth) {
    opts         = Object.assign({}, opts);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});

    if (withAuth !== false) {
      var token = _getToken();
      if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    }

    return fetch(path, opts)
      .then(function (res) {
        return res.json()
          .catch(function () { return {}; })
          .then(function (body) {
            if (!res.ok) {
              /* Allow login to store token when email verification is still pending */
              if (res.status === 403 && body.needsVerification && body.token) {
                _setToken(body.token);
              }
              var err    = new Error(body.message || 'Request failed (' + res.status + ')');
              err.status = res.status;
              err.needsVerification = !!body.needsVerification;
              err.user   = body.user || null;
              throw err;
            }
            return body;
          });
      });
  }

  /* ── Public API surface ─────────────────────────────── */
  global.SelectAI_API = {

    /* Auth */
    register: function (data) {
      return request('/api/auth/register', {
        method: 'POST',
        body:   JSON.stringify(data)
      }, /* withAuth= */ false)
        .then(function (res) { _setToken(res.token); return res; });
    },
    login: function (email, password) {
      return request('/api/auth/login', {
        method: 'POST',
        body:   JSON.stringify({ email: email, password: password })
      }, /* withAuth= */ false)
        .then(function (res) { _setToken(res.token); return res; });
    },
    getMe: function () {
      return request('/api/auth/me');
    },
    forgotPassword: function (email) {
      return request('/api/auth/forgot-password', {
        method: 'POST',
        body:   JSON.stringify({ email: email })
      }, /* withAuth= */ false);
    },
    resetPassword: function (token, password) {
      return request('/api/auth/reset-password', {
        method: 'POST',
        body:   JSON.stringify({ token: token, password: password })
      }, /* withAuth= */ false);
    },
    signOut: function () {
      _clearToken();
    },

    /* OTP */
    sendOtp: function () {
      return request('/api/otp/send', { method: 'POST' });
    },
    verifyOtp: function (code) {
      return request('/api/otp/verify', {
        method: 'POST',
        body:   JSON.stringify({ code: String(code) })
      });
    },

    /* Enquiries (no auth required) */
    submitEnquiry: function (data) {
      return request('/api/enquiries', {
        method: 'POST',
        body:   JSON.stringify(data)
      }, /* withAuth= */ false);
    },

    /* Session ping */
    pingSession: function (displayName) {
      return request('/api/sessions/ping', {
        method: 'POST',
        body:   JSON.stringify({ displayName: displayName || '' })
      });
    },

    /* Admin */
    getStats: function () {
      return request('/api/admin/stats');
    },
    getUsers: function () {
      return request('/api/admin/users');
    },
    getEnquiries: function () {
      return request('/api/admin/enquiries');
    },
    resetUserPassword: function (uid) {
      return request('/api/admin/users/' + encodeURIComponent(uid) + '/reset-password', {
        method: 'POST'
      });
    },
    createUser: function (data) {
      return request('/api/admin/users', {
        method: 'POST',
        body:   JSON.stringify(data)
      });
    },
    setUserRole: function (uid, role) {
      return request('/api/admin/users/' + encodeURIComponent(uid) + '/role', {
        method: 'PATCH',
        body:   JSON.stringify({ role: role })
      });
    },
    deleteUser: function (uid) {
      return request('/api/admin/users/' + encodeURIComponent(uid), {
        method: 'DELETE'
      });
    }
  };

}(window));
