/* =========================================================
   SelectAI — nav-user.js
   Shared user menu toggle and sign-out for site navigation.
   ========================================================= */
'use strict';

function toggleUserMenu() {
  var drop = document.getElementById('navUserDropdown');
  if (drop) drop.classList.toggle('open');
}

function signOutUser() {
  if (window.SelectAI_API) SelectAI_API.signOut();
  window.location.replace('index.html');
}

document.addEventListener('click', function (e) {
  var btn = document.getElementById('navUserBtn');
  var drop = document.getElementById('navUserDropdown');
  if (drop && drop.classList.contains('open') && btn && !btn.contains(e.target) && !drop.contains(e.target)) {
    drop.classList.remove('open');
  }
});
