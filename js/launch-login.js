/* =========================================================
   SelectAI — launch-login.js
   Countdown on login.html → We Are Live! → homepage
   ========================================================= */
'use strict';

(function () {
  var L = window.SelectAI_Launch;
  if (!L) return;

  var gate      = document.getElementById('launchGate');
  var countdown = document.getElementById('launchCountdown');
  var liveMsg   = document.getElementById('launchLiveMsg');
  var layout    = document.querySelector('.auth-layout');
  var timer     = null;

  function setPart(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = L.pad(val);
  }

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
    if (countdown) countdown.style.display = 'none';
    if (liveMsg) {
      liveMsg.hidden = false;
      liveMsg.classList.add('launch-live-show');
    }
    if (gate) gate.classList.add('launch-gate--live');

    setTimeout(function () {
      window.location.replace('index.html?launch=1');
    }, 2400);
  }

  function showAuth() {
    if (gate) gate.classList.add('launch-gate--hidden');
    if (layout) layout.classList.remove('auth-layout--gated');
  }

  if (L.isLive() || L.isPreview()) {
    showAuth();
    return;
  }

  if (layout) layout.classList.add('auth-layout--gated');
  tick();
  timer = setInterval(tick, 1000);
})();
