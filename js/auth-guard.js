/* =========================================================
   SelectAI — auth-guard.js  v20260609d
   Protects every page from unauthenticated access.
   Load AFTER app-config.js (in <head>).
   Uses JWT stored in localStorage — no Firebase dependency.
   ========================================================= */

(function () {
  'use strict';

  var TOKEN_KEY = 'selectai_token';
  var PAGE      = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  function _getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; }
  }

  /* ── No token → redirect to login ────────────────────── */
  var token = _getToken();
  if (!token) {
    if (PAGE !== 'login.html') window.location.replace('login.html');
    else document.documentElement.style.visibility = 'visible';
    return;
  }

  /* ── Fetch user profile from API ─────────────────────── */
  fetch('/api/auth/me', {
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type':  'application/json'
    }
  })
    .then(function (res) {
      if (res.status === 401 || res.status === 403) {
        /* Token expired or invalid — clear and go to login */
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        window.location.replace('login.html');
        return null;
      }
      return res.json();
    })
    .then(function (data) {
      if (!data) return;
      var profile = data.user || {};
      var role    = profile.role || 'user';

      window.SELECTAI_USER = {
        uid:         profile.uid         || '',
        displayName: ((profile.firstName || '') + ' ' + (profile.lastName || '')).trim(),
        firstName:   profile.firstName   || '',
        lastName:    profile.lastName    || '',
        email:       profile.email       || '',
        photoURL:    profile.photoURL    || '',
        role:        role,
        verified:    profile.verified    || false
      };

      /* Redirect non-admin away from admin.html */
      if (PAGE === 'admin.html' && role !== 'admin') {
        window.location.replace('index.html');
        return;
      }

      /* Ping active session (fire-and-forget) */
      _ping();
      setInterval(_ping, 2 * 60 * 1000);

      /* Reveal page and populate nav UI */
      document.documentElement.style.visibility = 'visible';
      document.addEventListener('DOMContentLoaded', function () {
        _applyUserToUI(window.SELECTAI_USER);
      });
      /* Also apply immediately if DOM is already ready */
      if (document.readyState !== 'loading') {
        _applyUserToUI(window.SELECTAI_USER);
      }
    })
    .catch(function (err) {
      console.error('[SelectAI] Auth guard error:', err.message);
      /* API unreachable (network down, nginx not proxying yet, etc.)
         — clear the stale token and send to login rather than exposing
         the protected page. */
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      if (PAGE !== 'login.html') {
        window.location.replace('login.html');
      } else {
        document.documentElement.style.visibility = 'visible';
      }
    });

  function _ping() {
    var t = _getToken();
    if (!t) return;
    fetch('/api/sessions/ping', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ displayName: (window.SELECTAI_USER || {}).displayName || '' })
    }).catch(function () {});
  }

  /* ── Apply user info to nav elements ─────────────────── */
  function _applyUserToUI(u) {
    var adminLink = document.getElementById('adminNavItem');
    if (adminLink) adminLink.style.display = (u.role === 'admin') ? '' : 'none';

    var nameEl = document.getElementById('navUserName');
    if (nameEl) nameEl.textContent = u.firstName || u.displayName || u.email;

    var avatarEl = document.getElementById('navUserAvatar');
    if (avatarEl && u.photoURL) {
      avatarEl.src = u.photoURL;
      avatarEl.style.display = 'block';
    }
  }

}());


