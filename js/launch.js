/* =========================================================
   SelectAI — launch.js
   Go-live gate: 26 Jun 2026, 6:30 PM IST
   ========================================================= */
'use strict';

(function (global) {
  var GO_LIVE_MS = new Date('2026-06-26T18:30:00+05:30').getTime();
  var LAUNCH_KEY = 'selectai_launch_seen';
  var IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

  function isLive() {
    return Date.now() >= GO_LIVE_MS;
  }

  function isPreview() {
    return /(?:\?|&)preview=1(?:&|$)/.test(global.location.search);
  }

  function _dateKeyIst(ms) {
    var d = new Date(ms + IST_OFFSET_MS);
    return [
      d.getUTCFullYear(),
      ('0' + (d.getUTCMonth() + 1)).slice(-2),
      ('0' + d.getUTCDate()).slice(-2)
    ].join('-');
  }

  function isLaunchDay() {
    return _dateKeyIst(Date.now()) === _dateKeyIst(GO_LIVE_MS);
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function getCountdownParts() {
    var diff = Math.max(0, GO_LIVE_MS - Date.now());
    var sec  = Math.floor(diff / 1000);
    return {
      days:    Math.floor(sec / 86400),
      hours:   Math.floor((sec % 86400) / 3600),
      minutes: Math.floor((sec % 3600) / 60),
      seconds: sec % 60,
      done:    diff <= 0
    };
  }

  function markLaunchSeen() {
    try { sessionStorage.setItem(LAUNCH_KEY, '1'); } catch (e) {}
  }

  function hasSeenLaunch() {
    try { return !!sessionStorage.getItem(LAUNCH_KEY); } catch (e) { return false; }
  }

  function shouldPlayHomeReveal() {
    if (!isLive() || !isLaunchDay()) return false;
    if (/(?:\?|&)launch=1(?:&|$)/.test(global.location.search)) return true;
    return !hasSeenLaunch();
  }

  global.SelectAI_Launch = {
    GO_LIVE_MS:        GO_LIVE_MS,
    isLive:            isLive,
    isLaunchDay:       isLaunchDay,
    isPreview:         isPreview,
    pad:               pad,
    getCountdownParts: getCountdownParts,
    markLaunchSeen:    markLaunchSeen,
    hasSeenLaunch:     hasSeenLaunch,
    shouldPlayHomeReveal: shouldPlayHomeReveal
  };
}(window));
