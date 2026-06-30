/* =========================================================
   SelectAI — admin.js  v20260609e
   Admin dashboard — MongoDB API, tables, CSV export.
   Depends on: js/api.js, auth-guard.js, admin.html DOM.
   ========================================================= */

(function () {
  'use strict';

  /* ── State ─────────────────────────────────────────────── */
  var allUsers      = [];
  var allEnquiries  = [];
  var usersFiltered = [];
  var enqFiltered   = [];
  var _pollTimer    = null;

  /* ── Load all dashboard data via API ───────────────────── */
  function loadDashboard() {
    if (!window.SelectAI_API) return;

    Promise.all([
      SelectAI_API.getStats(),
      SelectAI_API.getUsers(),
      SelectAI_API.getEnquiries()
    ]).then(function (results) {
      var stats     = results[0] || {};
      var userData  = results[1] || {};
      var enqData   = results[2] || {};

      /* Stats */
      _setText('statTotalUsers', stats.totalUsers  || 0);
      _setText('statActiveNow',  stats.activeNow   || 0);
      _setText('statEnquiries',  stats.totalEnquiries || 0);
      _setText('statNewToday',   stats.newToday    || 0);

      /* Users */
      allUsers      = userData.users  || [];
      usersFiltered = allUsers.slice();
      renderUsersTable(usersFiltered, 'usersTableWrap');
      renderUsersPreview(allUsers.slice(0, 5));
      _setText('userCount', allUsers.length + ' user' + (allUsers.length !== 1 ? 's' : ''));

      /* Enquiries */
      allEnquiries = enqData.enquiries || [];
      enqFiltered  = allEnquiries.slice();
      renderEnquiriesTable(enqFiltered, 'enquiriesTableWrap');
      renderEnquiriesPreview(allEnquiries.slice(0, 5));
      _setText('enqCount', allEnquiries.length + ' enquir' + (allEnquiries.length !== 1 ? 'ies' : 'y'));

    }).catch(function (err) {
      console.error('[SelectAI Admin] Data load error:', err.message);
    });
  }

  function _fullName(u) {
    if (!u) return '';
    var name = ((u.firstName || '') + ' ' + (u.lastName || '')).trim();
    return name || u.displayName || u.email || '';
  }

  function _setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  /* ── Bootstrap once auth confirms admin identity ──────── */
  document.addEventListener('DOMContentLoaded', function () {
    /* Populate header with admin display name */
    var u = window.SELECTAI_USER;
    if (u) {
      var nameEl = document.getElementById('adminName');
      if (nameEl) nameEl.textContent = _fullName(u);
    }

    /* Initial load */
    loadDashboard();

    /* Poll every 30 seconds */
    _pollTimer = setInterval(loadDashboard, 30 * 1000);
  });

  /* ── View switcher (called from HTML onclick) ──────────── */
  window.showView = function (name) {
    document.querySelectorAll('.adm-view').forEach(function (v) { v.classList.remove('active'); });
    document.querySelectorAll('.sb-nav a').forEach(function (a) { a.classList.remove('active'); });
    var view = document.getElementById('view-' + name);
    var nav  = document.getElementById('nav-' + name);
    if (view) view.classList.add('active');
    if (nav)  nav.classList.add('active');
    var titles = { dashboard: 'Dashboard Overview', users: 'User Management', enquiries: 'Enquiry Management' };
    var titleEl = document.getElementById('headerTitle');
    if (titleEl) titleEl.textContent = titles[name] || '';
  };

  /* ── Sign out ──────────────────────────────────────────── */
  window.signOutAdmin = function () {
    clearInterval(_pollTimer);
    if (window.SelectAI_API) SelectAI_API.signOut();
    window.location.replace('login.html');
  };

  /* ── Toast notification ──────────────────────────────── */
  function showToast(msg, type) {
    var el = document.getElementById('adminToast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'show ' + (type || '');
    clearTimeout(el._timer);
    el._timer = setTimeout(function () { el.className = ''; }, 4000);
  }

  /* ── Admin: Send password reset email via backend ──────── */
  window.adminResetPassword = function (uid, btnEl) {
    if (!uid) { showToast('No user ID provided.', 'error'); return; }
    if (btnEl) btnEl.disabled = true;
    SelectAI_API.resetUserPassword(uid)
      .then(function (data) {
        showToast(data.message || 'Reset email sent.', 'success');
        if (btnEl) btnEl.disabled = false;
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to send reset email.', 'error');
        if (btnEl) btnEl.disabled = false;
      });
  };

  /* ── Admin: Toggle user role ───────────────────────────── */
  window.adminToggleRole = function (uid, currentRole, btnEl) {
    if (!uid) return;
    var newRole = (currentRole === 'admin') ? 'user' : 'admin';
    var label   = (newRole === 'admin') ? 'promote to admin' : 'demote to user';
    if (!confirm('Are you sure you want to ' + label + '?')) return;
    if (btnEl) btnEl.disabled = true;
    SelectAI_API.setUserRole(uid, newRole)
      .then(function () {
        showToast('Role updated to ' + newRole + '.', 'success');
        loadDashboard();
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to update role.', 'error');
        if (btnEl) btnEl.disabled = false;
      });
  };

  /* ── Admin: Delete user ─────────────────────────────────── */
  window.adminDeleteUser = function (uid, email, btnEl) {
    if (!uid) return;
    if (!confirm('Permanently delete user ' + email + '? This cannot be undone.')) return;
    if (btnEl) btnEl.disabled = true;
    SelectAI_API.deleteUser(uid)
      .then(function () {
        showToast('User deleted.', 'success');
        loadDashboard();
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to delete user.', 'error');
        if (btnEl) btnEl.disabled = false;
      });
  };

  /* ── Create User modal ──────────────────────────────────── */
  window.openCreateUserModal = function () {
    var form = document.getElementById('createUserForm');
    if (form) form.reset();
    var btn = document.getElementById('cuSubmitBtn');
    if (btn) btn.disabled = false;
    var modal = document.getElementById('createUserModal');
    if (modal) modal.classList.add('open');
  };

  window.closeCreateUserModal = function () {
    var modal = document.getElementById('createUserModal');
    if (modal) modal.classList.remove('open');
    var btn = document.getElementById('cuSubmitBtn');
    if (btn) btn.disabled = false;
  };

  window.submitCreateUser = function (e) {
    e.preventDefault();
    var btn = document.getElementById('cuSubmitBtn');
    if (btn) btn.disabled = true;

    var data = {
      firstName: document.getElementById('cu_firstName').value.trim(),
      lastName:  document.getElementById('cu_lastName').value.trim(),
      email:     document.getElementById('cu_email').value.trim(),
      password:  document.getElementById('cu_password').value,
      phone:     document.getElementById('cu_phone').value.trim(),
      country:   document.getElementById('cu_country').value.trim(),
      role:      document.getElementById('cu_role').value
    };

    SelectAI_API.createUser(data)
      .then(function (res) {
        closeCreateUserModal();
        showToast(res.message || 'User created.', 'success');
        loadDashboard();
        if (btn) btn.disabled = false;
      })
      .catch(function (err) {
        showToast(err.message || 'Failed to create user.', 'error');
        if (btn) btn.disabled = false;
      });
  };

  /* ── Render: Users table ───────────────────────────────── */
  function handleUsersTableClick(e) {
    var btn = e.target.closest('[data-admin-action]');
    if (!btn) return;

    var action = btn.getAttribute('data-admin-action');
    var uid    = btn.getAttribute('data-uid') || '';
    if (!uid) {
      showToast('No user ID found for this row.', 'error');
      return;
    }

    if (action === 'reset-pw') {
      adminResetPassword(uid, btn);
    } else if (action === 'toggle-role') {
      adminToggleRole(uid, btn.getAttribute('data-role') || 'user', btn);
    } else if (action === 'delete') {
      adminDeleteUser(uid, btn.getAttribute('data-email') || '', btn);
    }
  }

  function renderUsersTable(rows, containerId) {
    var wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.removeEventListener('click', handleUsersTableClick);
    if (!rows.length) {
      wrap.innerHTML = '<table class="data-table"><tbody><tr class="empty-row"><td colspan="8">No users found.</td></tr></tbody></table>';
      return;
    }
    var html = '<div style="overflow-x:auto"><table class="data-table">'
      + '<thead><tr>'
      + '<th>Name</th><th>Email</th><th>Country</th><th>Role</th><th>Provider</th><th>Joined</th><th>Actions</th>'
      + '</tr></thead><tbody>';
    rows.forEach(function (u) {
      var uid       = u.uid || u._id || '';
      var safeEmail = esc(u.email || '');
      var role      = u.role || 'user';
      var toggleLabel = (role === 'admin') ? 'Make User' : 'Make Admin';
      html += '<tr>'
        + '<td>' + esc((u.firstName || '') + ' ' + (u.lastName || '')) + '</td>'
        + '<td><span class="truncate">' + safeEmail + '</span></td>'
        + '<td>' + esc(u.country || '—') + '</td>'
        + '<td><span class="role-badge role-' + role + '">' + role + '</span></td>'
        + '<td>' + esc(u.provider || '—') + '</td>'
        + '<td>' + fmtDate(u.createdAt) + '</td>'
        + '<td class="actions-cell">'
        + '<button type="button" class="action-btn" data-admin-action="reset-pw" data-uid="' + esc(uid) + '" title="Send password reset email">Reset PW</button>'
        + '<button type="button" class="action-btn" data-admin-action="toggle-role" data-uid="' + esc(uid) + '" data-role="' + esc(role) + '" title="' + esc(toggleLabel) + '">' + esc(toggleLabel) + '</button>'
        + '<button type="button" class="action-btn action-btn-danger" data-admin-action="delete" data-uid="' + esc(uid) + '" data-email="' + safeEmail + '" title="Delete user">Delete</button>'
        + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
    wrap.addEventListener('click', handleUsersTableClick);
  }

  function renderUsersPreview(rows) {
    renderUsersTable(rows, 'recentUsersWrap');
  }

  /* ── Render: Enquiries table ───────────────────────────── */
  function renderEnquiriesTable(rows, containerId) {
    var wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (!rows.length) {
      wrap.innerHTML = '<table class="data-table"><tbody><tr class="empty-row"><td colspan="6">No enquiries found.</td></tr></tbody></table>';
      return;
    }
    var html = '<div style="overflow-x:auto"><table class="data-table">'
      + '<thead><tr>'
      + '<th>Name</th><th>Email</th><th>Phone</th><th>Company</th><th>Message</th><th>Date</th>'
      + '</tr></thead><tbody>';
    rows.forEach(function (e) {
      html += '<tr>'
        + '<td>' + esc(e.name    || '—') + '</td>'
        + '<td><span class="truncate">' + esc(e.email   || '—') + '</span></td>'
        + '<td>' + esc(e.phone   || '—') + '</td>'
        + '<td>' + esc(e.company || '—') + '</td>'
        + '<td><span class="truncate">' + esc(e.message || '—') + '</span></td>'
        + '<td>' + fmtDate(e.createdAt) + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
    wrap.innerHTML = html;
  }

  function renderEnquiriesPreview(rows) {
    renderEnquiriesTable(rows, 'recentEnquiriesWrap');
  }

  /* ── Search / filter ───────────────────────────────────── */
  window.filterUsers = function (query) {
    var q = query.toLowerCase();
    usersFiltered = allUsers.filter(function (u) {
      return (u.firstName + ' ' + u.lastName + ' ' + u.email + ' ' + u.country)
        .toLowerCase().includes(q);
    });
    renderUsersTable(usersFiltered, 'usersTableWrap');
    var countEl = document.getElementById('userCount');
    if (countEl) countEl.textContent = usersFiltered.length + ' user' + (usersFiltered.length !== 1 ? 's' : '');
  };

  window.filterEnquiries = function (query) {
    var q = query.toLowerCase();
    enqFiltered = allEnquiries.filter(function (e) {
      return (e.name + ' ' + e.email + ' ' + e.company + ' ' + e.message)
        .toLowerCase().includes(q);
    });
    renderEnquiriesTable(enqFiltered, 'enquiriesTableWrap');
    var countEl = document.getElementById('enqCount');
    if (countEl) countEl.textContent = enqFiltered.length + ' enquir' + (enqFiltered.length !== 1 ? 'ies' : 'y');
  };

  /* ── CSV export ─────────────────────────────────────────── */
  window.exportUsers = function () {
    var rows = usersFiltered.map(function (u) {
      return {
        'First Name':  u.firstName || '',
        'Last Name':   u.lastName  || '',
        'Email':       u.email     || '',
        'Phone':       u.phone     || '',
        'Country':     u.country   || '',
        'Role':        u.role      || 'user',
        'Provider':    u.provider  || '',
        'Joined':      fmtDate(u.createdAt),
        'Last Login':  fmtDate(u.lastLogin)
      };
    });
    downloadCSV(rows, 'selectai-users-' + isoDate() + '.csv');
  };

  window.exportEnquiries = function () {
    var rows = enqFiltered.map(function (e) {
      return {
        'Name':    e.name    || '',
        'Email':   e.email   || '',
        'Phone':   e.phone   || '',
        'Company': e.company || '',
        'Message': e.message || '',
        'Date':    fmtDate(e.createdAt)
      };
    });
    downloadCSV(rows, 'selectai-enquiries-' + isoDate() + '.csv');
  };

  /* ── Utility: CSV download ──────────────────────────────── */
  function downloadCSV(rows, filename) {
    if (!rows.length) { alert('No data to export.'); return; }
    var headers = Object.keys(rows[0]);
    var lines   = rows.map(function (row) {
      return headers.map(function (h) {
        return '"' + (row[h] || '').toString().replace(/"/g, '""') + '"';
      }).join(',');
    });
    var csv  = '\uFEFF' + headers.join(',') + '\n' + lines.join('\n'); // BOM for Excel
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Utility: format Firestore timestamp ─────────────────── */
  function fmtDate(ts) {
    if (!ts) return '—';
    try {
      var d = (typeof ts.toDate === 'function') ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) { return '—'; }
  }

  function isoDate() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ── Utility: escape HTML ───────────────────────────────── */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

}());
