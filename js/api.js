/* =========================================================
   SelectAI — api.js
   Centralised API client for all backend calls.
   Automatically attaches Firebase ID token to every
   authenticated request.
   ========================================================= */
'use strict';

(function (global) {

  /* Get current Firebase ID token, or null in dev mode */
  function _getToken() {
    try {
      if (typeof firebase === 'undefined' ||
          !firebase.apps || !firebase.apps.length) return Promise.resolve(null);
      var user = firebase.auth().currentUser;
      if (!user) return Promise.resolve(null);
      return user.getIdToken(/* forceRefresh= */false);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  /**
   * Core fetch wrapper.
   * @param {string}  path       - API path, e.g. '/api/admin/users'
   * @param {object}  opts       - fetch options
   * @param {boolean} withAuth   - attach Bearer token (default: true)
   */
  function request(path, opts, withAuth) {
    opts         = Object.assign({}, opts);
    opts.headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});

    var tokenPromise = (withAuth !== false) ? _getToken() : Promise.resolve(null);

    return tokenPromise
      .then(function (token) {
        if (token) opts.headers['Authorization'] = 'Bearer ' + token;
        return fetch(path, opts);
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json()
            .catch(function () { return {}; })
            .then(function (body) {
              var err   = new Error(body.message || 'Request failed (' + res.status + ')');
              err.status = res.status;
              throw err;
            });
        }
        return res.json().catch(function () { return {}; });
      });
  }

  /* ── Public API surface ─────────────────────────────── */
  global.SelectAI_API = {

    /* Auth */
    upsertUser: function (data) {
      return request('/api/auth/user', {
        method: 'POST',
        body:   JSON.stringify(data)
      });
    },
    getMe: function () {
      return request('/api/auth/me');
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
    }
  };

}(window));
