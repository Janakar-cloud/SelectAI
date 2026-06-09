/* SelectAI runtime configuration */
(function () {
  'use strict';

  window.SELECTAI_CONFIG = {
    /* ── Lead form ──────────────────────────────────────────
       Set leadEndpoint to your backend URL to POST leads.
       Leave empty to fall back to mailto: (default).        */
    leadEndpoint: '',
    leadMethod:   'POST',

    /* ── KPI dashboard refresh (milliseconds) ──────────── */
    kpiRefreshMs: 60000,

    /* ── Firebase configuration ─────────────────────────
       1. Go to https://console.firebase.google.com/
       2. Create a project → Add web app → copy config below.
       3. Enable Auth → Sign-in methods → Google + Apple.
       4. Enable Firestore → Start in production mode.
       5. Set Firestore security rules (see SETUP.md).        */
    firebase: {
      apiKey:            'YOUR_API_KEY',
      authDomain:        'YOUR_PROJECT_ID.firebaseapp.com',
      projectId:         'YOUR_PROJECT_ID',
      storageBucket:     'YOUR_PROJECT_ID.appspot.com',
      messagingSenderId: 'YOUR_SENDER_ID',
      appId:             'YOUR_APP_ID'
    }
  };
}());
