/* =========================================================
   SelectAI — launch-login.js
   Countdown on login.html → We Are Live! → homepage
   Registered users can bypass the gate and sign in early.
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

  function showAuth() {
    authOpen = true;
    if (gate) gate.classList.add('launch-gate--hidden');
    if (layout) layout.classList.remove('auth-layout--gated');
    try { sessionStorage.setItem(SIGNIN_KEY, '1'); } catch (e) {}
  }

  window.openLaunchSignIn = function () {
    showAuth();
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
    /* User is signing in — don't pull them away to the homepage */
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

  if (L.isLive() || L.isPreview()) {
    showAuth();
    return;
  }

  /* Returning / registered users — show sign-in immediately */
  if (hasToken() || wantsSignIn()) {
    showAuth();
    tick();
    timer = setInterval(tick, 1000);
    return;
  }

  if (layout) layout.classList.add('auth-layout--gated');
  tick();
  timer = setInterval(tick, 1000);
})();
