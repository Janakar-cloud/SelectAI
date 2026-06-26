/* =========================================================
   SelectAI — launch-home.js
   Logo reveal + hero fade-in after go-live
   ========================================================= */
'use strict';

(function () {
  var L = window.SelectAI_Launch;
  if (!L || !L.shouldPlayHomeReveal()) {
    document.body.classList.remove('home-launch-pending');
    return;
  }

  var overlay = document.getElementById('homeLaunchReveal');
  var hero    = document.getElementById('hero');

  function revealSite() {
    document.body.classList.add('home-launch-active');
    if (overlay) overlay.classList.add('home-launch-reveal--out');
    if (hero) hero.classList.add('hero--revealed');

    setTimeout(function () {
      document.body.classList.remove('home-launch-pending');
      document.body.classList.add('home-launch-done');
      if (overlay) overlay.remove();
      L.markLaunchSeen();
      if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', 'index.html');
      }
    }, 2200);
  }

  document.body.classList.add('home-launch-pending');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(revealSite, 400);
    });
  } else {
    setTimeout(revealSite, 400);
  }
})();
