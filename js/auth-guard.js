/* =========================================================
   SelectAI — auth-guard.js  v20260609c
   Protects every page from unauthenticated access.
   Load AFTER Firebase SDKs and app-config.js (in <head>).
   Uses /api/auth/me (MongoDB) for role — no Firestore needed.
   ========================================================= */

(function () {
  'use strict';

  var cfg  = (window.SELECTAI_CONFIG || {}).firebase;
  var PAGE = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();

  /* ── Dev bypass: Firebase not yet configured ─────────── */
  if (!cfg || !cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY') {
    document.documentElement.style.visibility = 'visible';
    window.SELECTAI_USER = {
      uid: 'dev-uid', displayName: 'Dev User', firstName: 'Dev',
      email: 'dev@selectai.local', photoURL: '', role: 'admin'
    };
    document.addEventListener('DOMContentLoaded', function () {
      _applyUserToUI(window.SELECTAI_USER);
    });
    console.warn('[SelectAI] Firebase not configured — auth guard disabled (dev mode).');
    return;
  }

  /* ── Init Firebase (safe against double-init) ─────────── */
  if (!firebase.apps.length) {
    firebase.initializeApp(cfg);
  }

  var auth = firebase.auth();

  /* ── Auth state listener ──────────────────────────────── */
  auth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.replace('login.html');
      return;
    }

    /* Get Firebase ID token, then fetch user profile from MongoDB */
    user.getIdToken()
      .then(function (token) {
        return fetch('/api/auth/me', {
          headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type':  'application/json'
          }
        });
      })
      .then(function (res) {
        if (res.status === 404) {
          /* User not in MongoDB yet — happens on very first login before upsert completes */
          return { user: { role: 'user', verified: false, firstName: '', lastName: '' } };
        }
        return res.json();
      })
      .then(function (data) {
        var profile = data.user || {};
        var role    = profile.role || 'user';

        window.SELECTAI_USER = {
          uid:         user.uid,
          displayName: user.displayName || ((profile.firstName || '') + ' ' + (profile.lastName || '')).trim(),
          firstName:   profile.firstName || (user.displayName || '').split(' ')[0] || '',
          lastName:    profile.lastName  || '',
          email:       user.email        || profile.email || '',
          photoURL:    user.photoURL     || '',
          role:        role,
          verified:    profile.verified  || false
        };

        /* Redirect non-admin away from admin.html */
        if (PAGE === 'admin.html' && role !== 'admin') {
          window.location.replace('index.html');
          return;
        }

        /* Ping active session (fire-and-forget) */
        user.getIdToken().then(function (token) {
          fetch('/api/sessions/ping', {
            method:  'POST',
            headers: {
              'Authorization': 'Bearer ' + token,
              'Content-Type':  'application/json'
            },
            body: JSON.stringify({ displayName: window.SELECTAI_USER.displayName })
          }).catch(function () {});
        });

        /* Repeat session ping every 2 minutes */
        setInterval(function () {
          user.getIdToken().then(function (token) {
            fetch('/api/sessions/ping', {
              method:  'POST',
              headers: {
                'Authorization': 'Bearer ' + token,
                'Content-Type':  'application/json'
              },
              body: JSON.stringify({ displayName: window.SELECTAI_USER.displayName })
            }).catch(function () {});
          });
        }, 2 * 60 * 1000);

        /* Reveal page and populate nav UI */
        document.documentElement.style.visibility = 'visible';
        _applyUserToUI(window.SELECTAI_USER);
      })
      .catch(function (err) {
        console.error('[SelectAI] Auth guard error:', err.message);
        /* Show page anyway to avoid infinite blank screen */
        document.documentElement.style.visibility = 'visible';
      });
  });

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

