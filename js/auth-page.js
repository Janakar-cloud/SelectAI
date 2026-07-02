/* =========================================================
   SelectAI — auth-page.js  (signin.html)
   Sign In, Sign Up, OTP, Forgot Password, Reset Password
   ========================================================= */
'use strict';

/* ── Panel management ──────────────────────────────────── */
var PANELS = ['panelLogin','panelSignup','panelOtp','panelForgot','panelReset'];
var currentPanel = 'panelLogin';

function showPanel(id) {
  PANELS.forEach(function (p) {
    var el = document.getElementById(p);
    if (el) el.classList.toggle('active', p === id);
  });
  var tabsVisible = (id === 'panelLogin' || id === 'panelSignup');
  var tabs = document.querySelector('.auth-tabs');
  if (tabs) tabs.style.display = tabsVisible ? '' : 'none';
  currentPanel = id;
  clearMessages();
}

function switchTab(tab) {
  var isLogin = (tab === 'login');
  document.getElementById('tabLogin').classList.toggle('active',  isLogin);
  document.getElementById('tabSignup').classList.toggle('active', !isLogin);
  showPanel(isLogin ? 'panelLogin' : 'panelSignup');
  if (!isLogin) toggleSignupPhone();
}

window.toggleSignupPhone = function () {
  var country = (document.getElementById('spCountry').value || '').trim();
  var isIndia = country === 'IN';
  var wrap    = document.getElementById('spPhoneField');
  var phone   = document.getElementById('spPhone');
  if (wrap) wrap.hidden = !isIndia;
  if (phone) {
    phone.required = isIndia;
    if (!isIndia) phone.value = '';
  }
};

function showError(msg) {
  var el = document.getElementById('authError');
  el.textContent = msg; el.classList.add('show');
  document.getElementById('authSuccess').classList.remove('show');
}
function showSuccess(msg) {
  var el = document.getElementById('authSuccess');
  el.textContent = msg; el.classList.add('show');
  document.getElementById('authError').classList.remove('show');
}
function clearMessages() {
  document.getElementById('authError').classList.remove('show');
  document.getElementById('authSuccess').classList.remove('show');
}
function setLoading(on) {
  document.getElementById('authSpinner').classList.toggle('show', on);
  document.querySelectorAll('.oauth-btn, .auth-btn').forEach(function (b) {
    if (b.id === 'otpVerifyBtn') {
      if (on) b.disabled = true;
      return;
    }
    b.disabled = on;
  });
  if (!on) {
    var otpInputs = document.querySelectorAll('.otp-input');
    if (otpInputs.length) checkOtpComplete(otpInputs);
  }
}

window.handleSignIn = function () {
  var email    = (document.getElementById('liEmail').value    || '').trim();
  var password = (document.getElementById('liPassword').value || '');
  if (!email || !password) { showError('Please enter your email and password.'); return; }
  clearMessages();
  setLoading(true);
  SelectAI_API.login(email, password)
    .then(function () {
      setLoading(false);
      window.location.replace((window.SelectAI_ROUTES && window.SelectAI_ROUTES.home) || '/');
    })
    .catch(function (err) {
      setLoading(false);
      if (err.needsVerification && err.user) {
        showError(err.message || 'Please verify your email to continue.');
        initiateOtp(err.user.uid, err.user.email);
        return;
      }
      showError(err.message || 'Sign in failed. Please try again.');
    });
};

window.handleSignUp = function () {
  var data = {
    firstName: (document.getElementById('spFirstName').value || '').trim(),
    lastName:  (document.getElementById('spLastName').value  || '').trim(),
    phone:     (document.getElementById('spPhone').value     || '').trim(),
    email:     (document.getElementById('spEmail').value     || '').trim(),
    country:   (document.getElementById('spCountry').value   || '').trim(),
    password:  (document.getElementById('spPassword').value  || ''),
    confirm:   (document.getElementById('spConfirm').value   || '')
  };
  if (data.firstName.length < 2)                        { showError('First name must be at least 2 characters.'); return; }
  if (data.lastName.length  < 2)                        { showError('Last name must be at least 2 characters.'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))  { showError('Please enter a valid email address.'); return; }
  if (!data.country)                                    { showError('Please select your country.'); return; }
  if (data.country === 'IN') {
    var phoneDigits = data.phone.replace(/\D/g, '');
    if (phoneDigits.length < 8)                         { showError('Please enter a valid mobile number (at least 8 digits).'); return; }
  } else {
    data.phone = '';
  }
  if (data.password.length < 8)                         { showError('Password must be at least 8 characters.'); return; }
  if (!/[A-Z]/.test(data.password))                     { showError('Password must contain at least one uppercase letter.'); return; }
  if (!/[0-9]/.test(data.password))                     { showError('Password must contain at least one number.'); return; }
  if (data.password !== data.confirm)                   { showError('Passwords do not match.'); return; }
  clearMessages();
  setLoading(true);
  SelectAI_API.register(data)
    .then(function (res) {
      setLoading(false);
      if (res.otpSent) {
        openOtpPanel(res.user.email, res.devCode || null, res.user.uid);
      } else {
        initiateOtp(res.user.uid, res.user.email);
      }
    })
    .catch(function (err) {
      setLoading(false);
      showError(err.message || 'Registration failed. Please try again.');
    });
};

var _otpUid     = null;
var _otpCode    = null;
var _otpTimer   = null;
var _otpSeconds = 300;

function _startOtpCountdown() {
  _otpSeconds = 300;
  clearInterval(_otpTimer);
  _otpTimer = setInterval(function () {
    _otpSeconds -= 1;
    var m = Math.floor(_otpSeconds / 60);
    var s = _otpSeconds % 60;
    var el = document.getElementById('otpCountdown');
    if (el) el.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    if (_otpSeconds <= 0) {
      clearInterval(_otpTimer);
      showError('OTP expired. Please request a new code.');
      document.getElementById('otpVerifyBtn').disabled = true;
    }
  }, 1000);
}

function openOtpPanel(email, devCode, uid) {
  if (uid) _otpUid = uid;

  var devBox = document.getElementById('otpDevCode');
  var devVal = document.getElementById('otpDevValue');
  if (devCode) {
    _otpCode = devCode;
    if (devBox) devBox.style.display = 'block';
    if (devVal) devVal.textContent = devCode;
  } else {
    if (devBox) devBox.style.display = 'none';
    _otpCode = null;
  }

  document.getElementById('otpSubText').textContent =
    'We sent a 6-digit code to ' + (email || 'your email') + '. Enter it below to verify your account.';

  document.querySelectorAll('.otp-input').forEach(function (inp) {
    inp.value = ''; inp.classList.remove('filled');
  });
  document.getElementById('otpVerifyBtn').disabled = true;
  document.getElementById('otpResendBtn').disabled = false;

  showPanel('panelOtp');
  _startOtpCountdown();
  _refreshOtpVerifyState();
  var first = document.querySelector('.otp-input');
  if (first) setTimeout(function () { first.focus(); }, 100);
}

function initiateOtp(uid, email) {
  _otpUid = uid;

  setLoading(true);
  SelectAI_API.sendOtp()
    .then(function (res) {
      setLoading(false);
      openOtpPanel(email, res.devCode || null);
    })
    .catch(function (err) {
      setLoading(false);
      showError(err.message || 'Failed to send OTP. Please try again.');
    });
}

window.verifyOtp = function () {
  var entered = Array.from(document.querySelectorAll('.otp-input'))
    .map(function (i) { return i.value; }).join('');

  if (entered.length !== 6) { showError('Please enter all 6 digits.'); return; }

  setLoading(true);
  SelectAI_API.verifyOtp(entered)
    .then(function () {
      clearInterval(_otpTimer);
      setLoading(false);
      showSuccess('Email verified! Redirecting…');
      setTimeout(function () {
        window.location.replace((window.SelectAI_ROUTES && window.SelectAI_ROUTES.home) || '/');
      }, 1200);
    })
    .catch(function (err) {
      setLoading(false);
      showError(err.message || 'Verification failed. Please try again.');
    });
};

window.resendOtp = function () {
  var hasToken = false;
  try { hasToken = !!localStorage.getItem('selectai_token'); } catch (e) {}
  if (!hasToken) {
    showError('Session expired. Please register or sign in again.');
    return;
  }

  clearMessages();
  setLoading(true);
  var resendBtn = document.getElementById('otpResendBtn');
  if (resendBtn) resendBtn.disabled = true;

  SelectAI_API.sendOtp()
    .then(function (res) {
      setLoading(false);
      if (res.devCode) {
        _otpCode = res.devCode;
        var devBox = document.getElementById('otpDevCode');
        var devVal = document.getElementById('otpDevValue');
        if (devBox) devBox.style.display = 'block';
        if (devVal) devVal.textContent = res.devCode;
      }
      _startOtpCountdown();
      showSuccess('New code sent. Check your email.');
      document.getElementById('otpVerifyBtn').disabled = true;
      document.querySelectorAll('.otp-input').forEach(function (i) { i.value = ''; i.classList.remove('filled'); });
      _refreshOtpVerifyState();
      var first = document.querySelector('.otp-input');
      if (first) first.focus();
      setTimeout(function () {
        if (resendBtn) resendBtn.disabled = false;
      }, 30000);
    })
    .catch(function (err) {
      setLoading(false);
      if (resendBtn) resendBtn.disabled = false;
      showError(err.message || 'Failed to resend OTP.');
    });
};

window.cancelOtp = function () {
  clearInterval(_otpTimer);
  showPanel('panelLogin');
};

function checkOtpComplete(inputs) {
  var allFilled = Array.from(inputs).every(function (inp) { return inp.value.trim() !== ''; });
  var btn = document.getElementById('otpVerifyBtn');
  if (btn) btn.disabled = !allFilled;
}

function _refreshOtpVerifyState() {
  var inputs = document.querySelectorAll('.otp-input');
  if (!inputs.length) return;
  checkOtpComplete(inputs);
  setTimeout(function () { checkOtpComplete(inputs); }, 100);
  setTimeout(function () { checkOtpComplete(inputs); }, 500);
}

window.showForgotPanel = function (show) {
  if (show === false) {
    showPanel('panelLogin');
    document.getElementById('tabLogin').classList.add('active');
    document.getElementById('tabSignup').classList.remove('active');
    return;
  }
  showPanel('panelForgot');
};

window.handleForgotPassword = function () {
  var email = (document.getElementById('forgotEmail').value || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showError('Please enter a valid email address.'); return;
  }
  var btn = document.getElementById('forgotBtn');
  btn.disabled = true;
  clearMessages();
  SelectAI_API.forgotPassword(email)
    .then(function (res) {
      showSuccess(res.message || 'If an account exists for that email, a reset link has been sent.');
      document.getElementById('forgotEmail').value = '';
    })
    .catch(function (err) {
      showError(err.message || 'Failed to send reset email. Please try again.');
    })
    .finally(function () { btn.disabled = false; });
};

window.handleSetNewPassword = function () {
  var password = (document.getElementById('resetPassword').value || '');
  var confirm  = (document.getElementById('resetConfirm').value  || '');
  if (password.length < 8)           { showError('Password must be at least 8 characters.');        return; }
  if (!/[A-Z]/.test(password))       { showError('Password must contain at least one uppercase letter.'); return; }
  if (!/[0-9]/.test(password))       { showError('Password must contain at least one number.');     return; }
  if (password !== confirm)          { showError('Passwords do not match.');                        return; }

  var params = new URLSearchParams(window.location.search);
  var token  = params.get('reset');
  if (!token) { showError('Invalid or missing reset token. Please request a new link.'); return; }

  var btn = document.getElementById('resetBtn');
  btn.disabled = true;
  clearMessages();
  SelectAI_API.resetPassword(token, password)
    .then(function (res) {
      showSuccess(res.message || 'Password updated! Redirecting to sign in…');
      setTimeout(function () {
        window.history.replaceState({}, '', (window.SelectAI_ROUTES && window.SelectAI_ROUTES.signIn) || '/sign-in');
        showPanel('panelLogin');
        var tabs = document.querySelector('.auth-tabs');
        if (tabs) tabs.style.display = '';
      }, 2000);
    })
    .catch(function (err) {
      showError(err.message || 'Failed to reset password. The link may have expired.');
    })
    .finally(function () { btn.disabled = false; });
};

document.addEventListener('DOMContentLoaded', function () {
  var params = new URLSearchParams(window.location.search);

  if (params.get('tab') === 'signup') {
    switchTab('signup');
  }

  if (params.get('reset')) {
    showPanel('panelReset');
    var resetTabs = document.querySelector('.auth-tabs');
    if (resetTabs) resetTabs.style.display = 'none';
  }

  if (params.get('forgot') === '1') {
    showForgotPanel();
    var forgotTabs = document.querySelector('.auth-tabs');
    if (forgotTabs) forgotTabs.style.display = 'none';
  }

  var inputs = document.querySelectorAll('.otp-input');
  inputs.forEach(function (inp, idx) {
    function onOtpInputChange() {
      inp.value = inp.value.replace(/\D/g, '').slice(-1);
      inp.classList.toggle('filled', inp.value !== '');
      if (inp.value && idx < inputs.length - 1) inputs[idx + 1].focus();
      checkOtpComplete(inputs);
    }
    inp.addEventListener('input', onOtpInputChange);
    inp.addEventListener('change', onOtpInputChange);
    inp.addEventListener('keyup', function () { checkOtpComplete(inputs); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        inputs[idx - 1].value = '';
        inputs[idx - 1].classList.remove('filled');
        inputs[idx - 1].focus();
        checkOtpComplete(inputs);
      }
    });
    inp.addEventListener('paste', function (e) {
      e.preventDefault();
      var text = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      text.split('').forEach(function (ch, i) {
        if (inputs[i]) { inputs[i].value = ch; inputs[i].classList.add('filled'); }
      });
      checkOtpComplete(inputs);
      if (inputs[text.length]) inputs[text.length].focus();
      else if (inputs[inputs.length - 1]) inputs[inputs.length - 1].focus();
    });
  });

  if (params.get('verify') === 'pending') {
    SelectAI_API.getMe()
      .then(function (res) {
        var user = (res && res.user) || {};
        if (user.verified) {
          window.location.replace((window.SelectAI_ROUTES && window.SelectAI_ROUTES.home) || '/');
          return;
        }
        if (user.uid && user.email) {
          showPanel('panelOtp');
          var verifyTabs = document.querySelector('.auth-tabs');
          if (verifyTabs) verifyTabs.style.display = 'none';
          initiateOtp(user.uid, user.email);
        }
      })
      .catch(function () { /* stay on signin */ });
  }
});

window.updatePwStrength = function (val, prefix) {
  var barId   = prefix === 'reset' ? 'pwStrengthFillReset'  : 'pwStrengthFill';
  var labelId = prefix === 'reset' ? 'pwStrengthLabelReset' : 'pwStrengthLabel';
  var fill    = document.getElementById(barId);
  var label   = document.getElementById(labelId);
  if (!fill || !label) return;
  var score = 0;
  if (val.length >= 8)         score++;
  if (/[A-Z]/.test(val))       score++;
  if (/[0-9]/.test(val))       score++;
  if (/[^A-Za-z0-9]/.test(val)) score++;
  var pct    = ['0%','25%','50%','75%','100%'][score];
  var colour = ['#ff4444','#ff4444','#ffaa00','#88cc00','#00cc66'][score];
  var text   = ['','Weak','Fair','Good','Strong'][score];
  fill.style.width      = pct;
  fill.style.background = colour;
  label.textContent     = text;
  label.style.color     = colour;
};

window.togglePw = function (id, btn) {
  var inp = document.getElementById(id);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.setAttribute('aria-pressed', inp.type === 'text');
};
