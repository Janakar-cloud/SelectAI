/* Redirect domain root (/) to the public homepage when the wrong default file is served. */
(function () {
  'use strict';
  var path = (window.location.pathname || '').replace(/\/+$/, '');
  if (path === '' || path === '/') {
    window.location.replace('index.html');
  }
}());
