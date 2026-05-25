/* SelectAI runtime configuration */
(function () {
  'use strict';

  // Set leadEndpoint to your backend URL when available.
  // Example: 'https://api.yourdomain.com/leads'
  window.SELECTAI_CONFIG = {
    leadEndpoint: '',
    leadMethod: 'POST',
    kpiRefreshMs: 60000
  };
}());
