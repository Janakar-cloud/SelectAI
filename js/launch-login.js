/* =========================================================
   SelectAI — launch-login.js
   Countdown on login.html → We Are Live! → homepage
   Registered users can sign in early via the gate button.
   ========================================================= */
'use strict';

(function () {
  var L = window.SelectAI_Launch;
  if (!L) return;

  var SIGNIN_KEY = 'selectai_signin_access';
  var TOKEN_KEY  = 'selectai_token';

  var gate      = document.getElementById('launchGate');
  var countdown = document.getElementById('launchCountdown');
  var liveMsg   = document.getElementById('launchLiveMsg');
  var layout    = document.querySelector('.auth-layout');
  var timer     = null;
  var authOpen  = false;

  function hasToken() {
    try { return !!localStorage.getItem(TOKEN_KEY); } catch (e) { return false; }
  }

  function wantsSignIn() {
    if (/(?:\?|&)(?:signin|login)=1(?:&|$)/.test(window.location.search)) return true;
    try { return !!sessionStorage.getItem(SIGNIN_KEY); } catch (e) { return false; }
  }

  function setPart(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = L.pad(val);
  }

  /* Reveal the sign-in / sign-up forms, hide the countdown gate. */
  function showAuth() {
    authOpen = true;
    if (gate) gate.classList.add('launch-gate--hidden');
    if (layout) layout.classList.remove('auth-layout--gated');
  }

  /* Show the launch countdown gate (the launch page). */
  function showGate(signedIn) {
    authOpen = false;
    if (layout) layout.classList.add('auth-layout--gated');
    if (gate) gate.classList.remove('launch-gate--hidden');

    var btn  = document.getElementById('launchSignInBtn');
    var note = document.getElementById('launchGateNote');
    if (signedIn) {
      if (btn) btn.style.display = 'none';
      if (note) note.textContent = "You're signed in. The site goes live on 26 Jun 2026 at 6:30 PM IST.";
    }
  }

  window.openLaunchSignIn = function () {
    showAuth();
  };

  window.showLaunchGate = function (signedIn) {
    showGate(signedIn);
  };

  function tick() {
    var p = L.getCountdownParts();
    setPart('cdDays', p.days);
    setPart('cdHours', p.hours);
    setPart('cdMinutes', p.minutes);
    setPart('cdSeconds', p.seconds);

    if (p.done) {
      clearInterval(timer);
      onLive();
    }
  }

  function onLive() {
    /* User is filling the sign-in form — let them finish, don't redirect. */
    if (authOpen) {
      if (gate) gate.classList.add('launch-gate--hidden');
      return;
    }

    if (countdown) countdown.style.display = 'none';
    var signInBtn = document.getElementById('launchSignInBtn');
    if (signInBtn) signInBtn.style.display = 'none';
    if (liveMsg) {
      liveMsg.hidden = false;
      liveMsg.classList.add('launch-live-show');
    }
    if (gate) gate.classList.add('launch-gate--live');

    setTimeout(function () {
      window.location.replace('index.html?launch=1');
    }, 2400);
  }

  /* Already live (or after launch day, or preview) → straight to auth forms. */
  if (!L.isLaunchDay() || L.isLive() || L.isPreview()) {
    showAuth();
    return;
  }

  /* Launch day, before go-live: show the launch page (countdown). */
  if (hasToken()) {
    showGate(true);            /* already signed in — confirmation gate */
  } else if (wantsSignIn()) {
    showAuth();                /* explicit sign-in request */
  } else {
    showGate(false);           /* default launch countdown */
  }

  tick();
  timer = setInterval(tick, 1000);
})();
