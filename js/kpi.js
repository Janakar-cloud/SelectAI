/* SelectAI KPI dashboard */
(function () {
  'use strict';

  var config = window.SELECTAI_CONFIG || {};
  var refreshMs = Number(config.kpiRefreshMs) || 60000;

  var kpiStatus = document.getElementById('kpiStatus');
  var kpiUpdatedAt = document.getElementById('kpiUpdatedAt');
  var refreshKpi = document.getElementById('refreshKpi');

  if (!document.getElementById('kpiActiveUsers')) return;

  var kpiState = {
    activeUsers: 1320,
    projectsCompleted: 47,
    apiUptime: 99.9,
    trainingEnrollments: 286
  };

  var kpiTrendState = {
    activeUsers: [58, 62, 60, 68, 69, 71, 74, 70, 78, 80, 84, 88],
    projectsCompleted: [22, 24, 25, 26, 29, 30, 33, 34, 36, 39, 43, 47],
    apiUptime: [98, 99, 99, 100, 99, 100, 99, 100, 100, 99, 100, 100],
    trainingEnrollments: [32, 38, 44, 52, 61, 69, 83, 97, 118, 143, 197, 286]
  };

  function fmtNumber(value, decimals) {
    return Number(value).toLocaleString(undefined, {
      minimumFractionDigits: decimals || 0,
      maximumFractionDigits: decimals || 0
    });
  }

  function renderTrend(containerId, values) {
    var el = document.getElementById(containerId);
    if (!el) return;
    var max = Math.max.apply(null, values.concat([1]));
    el.innerHTML = values.map(function (value) {
      var pct = Math.max((value / max) * 100, 14);
      return '<i style="height:' + pct.toFixed(1) + '%"></i>';
    }).join('');
  }

  function renderKpis() {
    var activeUsersEl = document.getElementById('kpiActiveUsers');
    var projectsEl = document.getElementById('kpiProjects');
    var uptimeEl = document.getElementById('kpiUptime');
    var enrollmentsEl = document.getElementById('kpiEnrollments');

    if (activeUsersEl) activeUsersEl.textContent = fmtNumber(kpiState.activeUsers, 0);
    if (projectsEl) projectsEl.textContent = fmtNumber(kpiState.projectsCompleted, 0);
    if (uptimeEl) uptimeEl.textContent = fmtNumber(kpiState.apiUptime, 1);
    if (enrollmentsEl) enrollmentsEl.textContent = fmtNumber(kpiState.trainingEnrollments, 0);

    renderTrend('kpiTrendActiveUsers', kpiTrendState.activeUsers);
    renderTrend('kpiTrendProjects', kpiTrendState.projectsCompleted);
    renderTrend('kpiTrendUptime', kpiTrendState.apiUptime);
    renderTrend('kpiTrendEnrollments', kpiTrendState.trainingEnrollments);

    if (kpiUpdatedAt) kpiUpdatedAt.textContent = new Date().toLocaleTimeString();
  }

  function updateKpiValues() {
    kpiState.activeUsers += Math.floor(Math.random() * 12) - 3;
    kpiState.activeUsers = Math.max(900, kpiState.activeUsers);

    kpiState.projectsCompleted += (Math.random() > 0.75 ? 1 : 0);

    kpiState.apiUptime += (Math.random() * 0.12) - 0.06;
    kpiState.apiUptime = Math.max(98.8, Math.min(100, kpiState.apiUptime));

    kpiState.trainingEnrollments += Math.floor(Math.random() * 8);

    kpiTrendState.activeUsers.shift();
    kpiTrendState.activeUsers.push(kpiState.activeUsers);
    kpiTrendState.projectsCompleted.shift();
    kpiTrendState.projectsCompleted.push(kpiState.projectsCompleted);
    kpiTrendState.apiUptime.shift();
    kpiTrendState.apiUptime.push(kpiState.apiUptime);
    kpiTrendState.trainingEnrollments.shift();
    kpiTrendState.trainingEnrollments.push(kpiState.trainingEnrollments);

    renderKpis();
  }

  if (refreshKpi) {
    refreshKpi.addEventListener('click', function () {
      if (kpiStatus) kpiStatus.textContent = 'Refreshing';
      window.setTimeout(function () {
        updateKpiValues();
        if (kpiStatus) kpiStatus.textContent = 'Live';
      }, 350);
    });
  }

  renderKpis();
  window.setInterval(updateKpiValues, refreshMs);
}());
