/* =========================================================
   SelectAI Assistant — floating AI chat widget
   v20260622
   ========================================================= */
(function () {
  'use strict';

  /* ── Config ─────────────────────────────────────────── */
  var CHAT_ENDPOINT = '/api/chat';
  var QUICK_CHIPS = [
    'What is SelectAI?',
    'Tell me about the AI/ML course',
    'What services do you offer?',
    'How do I enroll?',
    'Who are the founders?',
    'Contact info'
  ];

  /* ── State ───────────────────────────────────────────── */
  var history  = [];   // { role, content }
  var isOpen   = false;
  var isTyping = false;

  /* ── Inject styles ───────────────────────────────────── */
  var style = document.createElement('style');
  style.textContent = [
    ':root{',
    '  --sai-bg:#07071a;',
    '  --sai-surface:rgba(255,255,255,.04);',
    '  --sai-border:rgba(0,229,255,.18);',
    '  --sai-cyan:#00e5ff;',
    '  --sai-pink:#ff006e;',
    '  --sai-purple:#9b00ff;',
    '  --sai-white:#ffffff;',
    '  --sai-muted:rgba(221,224,245,.78);',
    '  --sai-grad:linear-gradient(135deg,#ff006e,#9b00ff,#00e5ff);',
    '  --sai-r:12px;',
    '  --sai-ease:all .3s cubic-bezier(.22,1,.36,1);',
    '}',

    /* Toggle button */
    '#sai-toggle{',
    '  position:fixed;bottom:28px;right:28px;z-index:9999;',
    '  width:auto;height:46px;border-radius:23px;padding:0 18px;',
    '  background:#07071a;',
    '  border:1px solid rgba(0,229,255,.28);',
    '  cursor:pointer;',
    '  display:flex;align-items:center;justify-content:center;',
    '  box-shadow:0 0 0 0 rgba(0,229,255,.3),0 8px 28px rgba(0,0,0,.6);',
    '  transition:var(--sai-ease);',
    '  outline:none;',
    '}',
    '#sai-toggle:hover{transform:translateY(-2px);box-shadow:0 0 0 6px rgba(0,229,255,.1),0 12px 32px rgba(0,0,0,.7);border-color:rgba(0,229,255,.55);}',,
    '#sai-toggle svg{width:26px;height:26px;fill:#fff;transition:var(--sai-ease);}',
    '#sai-toggle img.sai-icon-chat{height:26px;width:auto;object-fit:contain;transition:var(--sai-ease);}',
    '#sai-toggle.sai-open img.sai-icon-chat{display:none;}',
    '#sai-toggle:not(.sai-open) svg.sai-icon-close{display:none;}',

    /* Unread dot */
    '#sai-unread{',
    '  position:absolute;top:4px;right:4px;',
    '  width:10px;height:10px;border-radius:50%;',
    '  background:var(--sai-pink);',
    '  border:2px solid #07071a;',
    '  animation:saiPulse 2s ease-in-out infinite;',
    '  display:none;',
    '}',
    '#sai-toggle.sai-open #sai-unread{display:none!important;}',
    '@keyframes saiPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.3);opacity:.7}}',

    /* Chat panel */
    '#sai-panel{',
    '  position:fixed;bottom:100px;right:28px;z-index:9998;',
    '  width:min(380px,calc(100vw - 40px));',
    '  height:min(540px,calc(100dvh - 140px));',
    '  display:flex;flex-direction:column;',
    '  background:var(--sai-bg);',
    '  border:1px solid var(--sai-border);',
    '  border-radius:20px;',
    '  box-shadow:0 24px 64px rgba(0,0,0,.7),0 0 0 1px rgba(0,229,255,.06);',
    '  overflow:hidden;',
    '  transform:translateY(20px) scale(.95);',
    '  opacity:0;',
    '  pointer-events:none;',
    '  transition:transform .35s cubic-bezier(.22,1,.36,1),opacity .3s ease;',
    '}',
    '#sai-panel.sai-open{transform:translateY(0) scale(1);opacity:1;pointer-events:all;}',

    /* Header */
    '#sai-header{',
    '  display:flex;align-items:center;gap:12px;',
    '  padding:14px 16px;',
    '  background:linear-gradient(135deg,rgba(155,0,255,.14),rgba(0,229,255,.08));',
    '  border-bottom:1px solid var(--sai-border);',
    '  flex-shrink:0;',
    '}',
    '.sai-avatar{',
    '  width:36px;height:36px;border-radius:50%;',
    '  background:#ffffff;',
    '  display:flex;align-items:center;justify-content:center;',
    '  flex-shrink:0;',
    '  box-shadow:0 0 14px rgba(0,229,255,.3);',
    '  overflow:hidden;padding:4px;',
    '}',
    '.sai-avatar img{width:100%;height:100%;object-fit:contain;}',
    '.sai-avatar svg{width:18px;height:18px;fill:#fff;}',
    '.sai-header-text{flex:1;min-width:0;}',
    '.sai-header-name{font-family:"Orbitron",monospace;font-size:.72rem;font-weight:700;color:var(--sai-white);letter-spacing:.06em;}',
    '.sai-header-status{font-size:.68rem;color:var(--sai-cyan);display:flex;align-items:center;gap:5px;margin-top:2px;}',
    '.sai-dot{width:6px;height:6px;border-radius:50%;background:var(--sai-cyan);animation:saiPulse 2s ease-in-out infinite;}',
    '#sai-close{background:none;border:none;cursor:pointer;padding:4px;color:rgba(221,224,245,.6);transition:var(--sai-ease);border-radius:6px;display:flex;}',
    '#sai-close:hover{color:var(--sai-white);background:rgba(255,255,255,.08);}',
    '#sai-close svg{width:18px;height:18px;fill:currentColor;}',

    /* Messages */
    '#sai-messages{',
    '  flex:1;overflow-y:auto;padding:14px 14px 8px;',
    '  display:flex;flex-direction:column;gap:10px;',
    '  scroll-behavior:smooth;',
    '}',
    '#sai-messages::-webkit-scrollbar{width:4px;}',
    '#sai-messages::-webkit-scrollbar-track{background:transparent;}',
    '#sai-messages::-webkit-scrollbar-thumb{background:rgba(0,229,255,.2);border-radius:2px;}',

    /* Bubbles */
    '.sai-msg{max-width:88%;display:flex;flex-direction:column;gap:3px;}',
    '.sai-msg.sai-user{align-self:flex-end;align-items:flex-end;}',
    '.sai-msg.sai-bot{align-self:flex-start;align-items:flex-start;}',
    '.sai-bubble{',
    '  padding:9px 13px;border-radius:14px;',
    '  font-family:"Space Grotesk",sans-serif;font-size:.85rem;line-height:1.6;',
    '  word-break:break-word;',
    '}',
    '.sai-msg.sai-user .sai-bubble{',
    '  background:linear-gradient(135deg,rgba(155,0,255,.35),rgba(0,229,255,.22));',
    '  border:1px solid rgba(0,229,255,.2);',
    '  color:var(--sai-white);',
    '  border-bottom-right-radius:4px;',
    '}',
    '.sai-msg.sai-bot .sai-bubble{',
    '  background:rgba(255,255,255,.05);',
    '  border:1px solid rgba(255,255,255,.08);',
    '  color:var(--sai-muted);',
    '  border-bottom-left-radius:4px;',
    '}',
    '.sai-bubble ul{margin:.4em 0 .2em 1.2em;padding:0;display:flex;flex-direction:column;gap:.25em;}',
    '.sai-bubble li{font-size:.83rem;}',
    '.sai-bubble a{color:var(--sai-cyan);text-decoration:none;}',
    '.sai-bubble a:hover{text-decoration:underline;}',
    '.sai-msg-time{font-size:.62rem;color:rgba(136,144,181,.7);padding:0 4px;}',

    /* Typing indicator */
    '#sai-typing{align-self:flex-start;display:none;padding:10px 14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:14px;border-bottom-left-radius:4px;}',
    '#sai-typing.sai-show{display:flex;gap:5px;align-items:center;}',
    '.sai-ty-dot{width:6px;height:6px;border-radius:50%;background:var(--sai-cyan);animation:saiTypeDot 1.2s ease-in-out infinite;}',
    '.sai-ty-dot:nth-child(2){animation-delay:.18s;}',
    '.sai-ty-dot:nth-child(3){animation-delay:.36s;}',
    '@keyframes saiTypeDot{0%,80%,100%{transform:scale(.55);opacity:.4}40%{transform:scale(1);opacity:1}}',

    /* CTA row */
    '#sai-cta{',
    '  display:none;padding:8px 14px;',
    '  background:rgba(0,229,255,.04);',
    '  border-top:1px solid rgba(0,229,255,.1);',
    '  flex-shrink:0;',
    '}',
    '#sai-cta.sai-show{display:flex;gap:8px;flex-wrap:wrap;align-items:center;}',
    '.sai-cta-lbl{font-family:"Orbitron",monospace;font-size:.58rem;letter-spacing:.12em;color:rgba(136,144,181,.9);text-transform:uppercase;flex-basis:100%;}',
    '.sai-cta-btn{',
    '  display:inline-flex;align-items:center;gap:5px;',
    '  padding:.38rem .75rem;border-radius:999px;',
    '  background:rgba(255,255,255,.04);',
    '  border:1px solid rgba(0,229,255,.2);',
    '  font-family:"Orbitron",monospace;font-size:.58rem;letter-spacing:.08em;text-transform:uppercase;',
    '  color:var(--sai-cyan);cursor:pointer;',
    '  text-decoration:none;',
    '  transition:var(--sai-ease);',
    '}',
    '.sai-cta-btn:hover{background:rgba(0,229,255,.1);border-color:var(--sai-cyan);}',
    '.sai-cta-btn svg{width:11px;height:11px;fill:currentColor;flex-shrink:0;}',

    /* Chips */
    '#sai-chips{',
    '  padding:8px 14px 6px;',
    '  display:flex;gap:6px;flex-wrap:wrap;',
    '  border-top:1px solid rgba(255,255,255,.05);',
    '  flex-shrink:0;',
    '}',
    '#sai-chips.sai-hidden{display:none;}',
    '.sai-chip{',
    '  padding:.32rem .7rem;border-radius:999px;',
    '  background:rgba(255,255,255,.04);',
    '  border:1px solid rgba(0,229,255,.16);',
    '  font-family:"Space Grotesk",sans-serif;font-size:.74rem;',
    '  color:var(--sai-muted);cursor:pointer;',
    '  white-space:nowrap;',
    '  transition:var(--sai-ease);',
    '}',
    '.sai-chip:hover{background:rgba(0,229,255,.08);border-color:rgba(0,229,255,.35);color:var(--sai-white);}',

    /* Input row */
    '#sai-input-row{',
    '  display:flex;gap:8px;align-items:flex-end;',
    '  padding:10px 14px 14px;',
    '  border-top:1px solid rgba(255,255,255,.06);',
    '  flex-shrink:0;',
    '}',
    '#sai-input{',
    '  flex:1;resize:none;',
    '  background:rgba(255,255,255,.05);',
    '  border:1px solid rgba(0,229,255,.2);',
    '  border-radius:10px;',
    '  color:var(--sai-white);',
    '  font-family:"Space Grotesk",sans-serif;font-size:.85rem;',
    '  line-height:1.5;',
    '  padding:9px 11px;',
    '  outline:none;',
    '  transition:border-color .2s;',
    '  max-height:96px;',
    '  overflow-y:auto;',
    '}',
    '#sai-input::-webkit-scrollbar{width:3px;}',
    '#sai-input::-webkit-scrollbar-thumb{background:rgba(0,229,255,.2);}',
    '#sai-input::placeholder{color:rgba(136,144,181,.55);}',
    '#sai-input:focus{border-color:var(--sai-cyan);box-shadow:0 0 0 3px rgba(0,229,255,.08);}',
    '#sai-send{',
    '  width:38px;height:38px;border-radius:10px;',
    '  background:var(--sai-grad);',
    '  border:none;cursor:pointer;',
    '  display:flex;align-items:center;justify-content:center;',
    '  flex-shrink:0;',
    '  transition:var(--sai-ease);',
    '  opacity:.9;',
    '}',
    '#sai-send:hover{opacity:1;transform:scale(1.08);}',
    '#sai-send:disabled{opacity:.4;cursor:not-allowed;transform:none;}',
    '#sai-send svg{width:17px;height:17px;fill:#fff;}',

    /* Error banner */
    '#sai-error{',
    '  display:none;',
    '  margin:0 14px 8px;padding:9px 12px;',
    '  background:rgba(255,0,110,.1);',
    '  border:1px solid rgba(255,0,110,.28);',
    '  border-radius:8px;',
    '  font-family:"Space Grotesk",sans-serif;font-size:.78rem;',
    '  color:#ff6b9d;',
    '  flex-shrink:0;',
    '}',
    '#sai-error.sai-show{display:block;}',

    /* Mobile */
    '@media(max-width:480px){',
    '  #sai-toggle{bottom:18px;right:18px;height:40px;padding:0 14px;}',,
    '  #sai-panel{bottom:88px;right:12px;left:12px;width:auto;height:min(500px,calc(100dvh - 120px));}',
    '}',

    /* Reduced motion */
    '@media(prefers-reduced-motion:reduce){',
    '  #sai-toggle,#sai-panel,#sai-unread,.sai-ty-dot{animation:none!important;transition:none!important;}',
    '}'
  ].join('');
  document.head.appendChild(style);

  /* ── Build DOM ───────────────────────────────────────── */
  function svg(path, extra) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    if (extra) s.setAttribute('class', extra);
    s.innerHTML = path;
    return s;
  }

  var ICON_CHAT  = '<path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>';
  var ICON_CLOSE = '<path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>';
  var ICON_SEND  = '<path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2 .01 7z"/>';
  var ICON_BOT   = '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l7 4.5-7 4.5z"/>';
  var ICON_MAIL  = '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"/>';
  var ICON_LI    = '<path d="M19 3A2 2 0 0 1 21 5V19A2 2 0 0 1 19 21H5A2 2 0 0 1 3 19V5A2 2 0 0 1 5 3H19ZM8.34 18.34V9.59H5.43V18.34H8.34ZM6.89 8.39C7.82 8.39 8.57 7.62 8.57 6.69 8.57 5.76 7.82 5 6.89 5 5.96 5 5.2 5.76 5.2 6.69 5.2 7.62 5.96 8.39 6.89 8.39ZM18.8 18.34V13.56C18.8 11.01 17.44 9.4 15.02 9.4 13.85 9.4 13.06 10.04 12.74 10.66V9.59H9.84C9.88 10.3 9.84 18.34 9.84 18.34H12.74V13.45C12.74 12.58 12.91 12.23 14.35 12.23 15.54 12.23 15.93 13.14 15.93 14.48V18.34H18.8Z"/>';
  var ICON_ENROL = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';

  /* Toggle button */
  var toggle = document.createElement('button');
  toggle.id = 'sai-toggle';
  toggle.setAttribute('aria-label', 'Open SelectAI Assistant');
  toggle.setAttribute('aria-expanded', 'false');
  var unread = document.createElement('span');
  unread.id = 'sai-unread';
  var toggleLogoImg = document.createElement('img');
  toggleLogoImg.src = 'assets/images/logo-full.png';
  toggleLogoImg.alt = 'SelectAI';
  toggleLogoImg.className = 'sai-icon-chat';
  toggle.appendChild(toggleLogoImg);
  toggle.appendChild(svg(ICON_CLOSE, 'sai-icon-close'));
  toggle.appendChild(unread);

  /* Panel */
  var panel = document.createElement('div');
  panel.id = 'sai-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'SelectAI Assistant chat');

  /* Header */
  var header = document.createElement('div');
  header.id = 'sai-header';
  var avatarEl = document.createElement('div');
  avatarEl.className = 'sai-avatar';
  var avatarImg = document.createElement('img');
  avatarImg.src = 'assets/images/logo-mark.png';
  avatarImg.alt = 'SelectAI';
  avatarEl.appendChild(avatarImg);
  var headerText = document.createElement('div');
  headerText.className = 'sai-header-text';
  var headerName = document.createElement('div');
  headerName.className = 'sai-header-name';
  headerName.textContent = 'SelectAI Assistant';
  var headerStatus = document.createElement('div');
  headerStatus.className = 'sai-header-status';
  var dot = document.createElement('span');
  dot.className = 'sai-dot';
  headerStatus.appendChild(dot);
  headerStatus.appendChild(document.createTextNode('Online · AI-powered'));
  headerText.appendChild(headerName);
  headerText.appendChild(headerStatus);
  var closeBtn = document.createElement('button');
  closeBtn.id = 'sai-close';
  closeBtn.setAttribute('aria-label', 'Close chat');
  closeBtn.appendChild(svg(ICON_CLOSE));
  header.appendChild(avatarEl);
  header.appendChild(headerText);
  header.appendChild(closeBtn);

  /* Messages */
  var messages = document.createElement('div');
  messages.id = 'sai-messages';
  var typingEl = document.createElement('div');
  typingEl.id = 'sai-typing';
  typingEl.setAttribute('aria-live', 'polite');
  typingEl.setAttribute('aria-label', 'SelectAI is typing');
  [0, 1, 2].forEach(function () {
    var d = document.createElement('div');
    d.className = 'sai-ty-dot';
    typingEl.appendChild(d);
  });

  /* Error */
  var errorEl = document.createElement('div');
  errorEl.id = 'sai-error';
  errorEl.setAttribute('role', 'alert');

  /* CTA */
  var ctaRow = document.createElement('div');
  ctaRow.id = 'sai-cta';
  var ctaLbl = document.createElement('span');
  ctaLbl.className = 'sai-cta-lbl';
  ctaLbl.textContent = 'Get in touch';
  var ctaEmail = document.createElement('a');
  ctaEmail.className = 'sai-cta-btn';
  ctaEmail.href = 'mailto:selectaiinnovations@gmail.com';
  ctaEmail.target = '_blank';
  ctaEmail.rel = 'noopener noreferrer';
  ctaEmail.appendChild(svg(ICON_MAIL));
  ctaEmail.appendChild(document.createTextNode('Email Us'));
  var ctaLI = document.createElement('a');
  ctaLI.className = 'sai-cta-btn';
  ctaLI.href = 'https://www.linkedin.com/in/selectai-innovations-8633363bb';
  ctaLI.target = '_blank';
  ctaLI.rel = 'noopener noreferrer';
  ctaLI.appendChild(svg(ICON_LI));
  ctaLI.appendChild(document.createTextNode('LinkedIn'));
  var ctaEnroll = document.createElement('a');
  ctaEnroll.className = 'sai-cta-btn';
  ctaEnroll.href = 'practical-ai-ml-engineering.html#enroll';
  ctaEnroll.appendChild(svg(ICON_ENROL));
  ctaEnroll.appendChild(document.createTextNode('Enroll Now'));
  ctaRow.appendChild(ctaLbl);
  ctaRow.appendChild(ctaEmail);
  ctaRow.appendChild(ctaLI);
  ctaRow.appendChild(ctaEnroll);

  /* Chips */
  var chipsRow = document.createElement('div');
  chipsRow.id = 'sai-chips';
  QUICK_CHIPS.forEach(function (text) {
    var chip = document.createElement('button');
    chip.className = 'sai-chip';
    chip.textContent = text;
    chip.type = 'button';
    chip.addEventListener('click', function () { sendMessage(text); });
    chipsRow.appendChild(chip);
  });

  /* Input */
  var inputRow = document.createElement('div');
  inputRow.id = 'sai-input-row';
  var input = document.createElement('textarea');
  input.id = 'sai-input';
  input.placeholder = 'Ask me anything about SelectAI…';
  input.rows = 1;
  input.setAttribute('maxlength', '600');
  input.setAttribute('aria-label', 'Chat message');
  var sendBtn = document.createElement('button');
  sendBtn.id = 'sai-send';
  sendBtn.type = 'button';
  sendBtn.setAttribute('aria-label', 'Send message');
  sendBtn.appendChild(svg(ICON_SEND));
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);

  /* Assemble */
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(typingEl);
  panel.appendChild(errorEl);
  panel.appendChild(ctaRow);
  panel.appendChild(chipsRow);
  panel.appendChild(inputRow);

  document.body.appendChild(toggle);
  document.body.appendChild(panel);

  /* ── Auto-resize textarea ────────────────────────────── */
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 96) + 'px';
  });

  /* ── Open / close ────────────────────────────────────── */
  function openChat() {
    isOpen = true;
    panel.classList.add('sai-open');
    toggle.classList.add('sai-open');
    toggle.setAttribute('aria-expanded', 'true');
    unread.style.display = 'none';
    input.focus();
    scrollToBottom();
    if (messages.children.length === 0) showWelcome();
  }

  function closeChat() {
    isOpen = false;
    panel.classList.remove('sai-open');
    toggle.classList.remove('sai-open');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    isOpen ? closeChat() : openChat();
  });
  closeBtn.addEventListener('click', closeChat);

  /* Close on Escape */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closeChat();
  });

  /* ── Welcome message ─────────────────────────────────── */
  function showWelcome() {
    appendBotMessage(
      "Hi, I'm the SelectAI Assistant. I can help you explore our AI solutions, SaaS services, training programmes, the Practical AI/ML Engineering course, and more.\n\nWhat would you like to know?"
    );
    showCta(true);
    setTimeout(function () { unread.style.display = 'none'; }, 200);
  }

  /* ── Show unread dot when closed ────────────────────── */
  function triggerUnread() {
    if (!isOpen) {
      unread.style.display = 'block';
    }
  }

  /* Trigger unread dot after 4s on first visit */
  setTimeout(function () {
    if (!isOpen) triggerUnread();
  }, 4000);

  /* ── Append messages ─────────────────────────────────── */
  function now() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(role, text) {
    var msgEl = document.createElement('div');
    msgEl.className = 'sai-msg sai-' + role;

    var bubble = document.createElement('div');
    bubble.className = 'sai-bubble';
    bubble.innerHTML = formatText(text);

    var time = document.createElement('span');
    time.className = 'sai-msg-time';
    time.setAttribute('aria-hidden', 'true');
    time.textContent = now();

    msgEl.appendChild(bubble);
    msgEl.appendChild(time);
    messages.appendChild(msgEl);
    scrollToBottom();
    return msgEl;
  }

  function appendUserMessage(text) { return appendMessage('user', text); }
  function appendBotMessage(text)  { return appendMessage('bot', text);  }

  /* Convert plain text to basic HTML (line breaks + markdown-style bold/bullets) */
  function formatText(text) {
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    /* Bold: **text** */
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    /* Markdown list → <ul> */
    var lines = escaped.split('\n');
    var inList = false;
    var out = [];
    lines.forEach(function (line) {
      var listMatch = line.match(/^[-•]\s+(.*)/);
      if (listMatch) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push('<li>' + listMatch[1] + '</li>');
      } else {
        if (inList) { out.push('</ul>'); inList = false; }
        if (line.trim() === '') {
          out.push('<br>');
        } else {
          out.push(line);
        }
      }
    });
    if (inList) out.push('</ul>');

    return out.join('\n').replace(/\n<br>/g, '<br>').replace(/(<br>){3,}/g, '<br><br>');
  }

  /* ── Scroll helpers ──────────────────────────────────── */
  function scrollToBottom() {
    requestAnimationFrame(function () {
      messages.scrollTop = messages.scrollHeight;
    });
  }

  /* ── Typing indicator ────────────────────────────────── */
  function showTyping() {
    typingEl.classList.add('sai-show');
    messages.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    typingEl.classList.remove('sai-show');
  }

  /* ── CTA row ─────────────────────────────────────────── */
  function showCta(on) {
    if (on) ctaRow.classList.add('sai-show');
    else ctaRow.classList.remove('sai-show');
  }

  /* ── Error banner ────────────────────────────────────── */
  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.classList.add('sai-show');
    setTimeout(function () { errorEl.classList.remove('sai-show'); }, 5000);
  }

  /* ── Hide chips after first user message ─────────────── */
  var chipsHidden = false;
  function hideChips() {
    if (!chipsHidden) {
      chipsRow.classList.add('sai-hidden');
      chipsHidden = true;
    }
  }

  /* ── Core send logic ─────────────────────────────────── */
  function sendMessage(text) {
    text = (text || '').trim();
    if (!text || isTyping) return;

    hideChips();
    appendUserMessage(text);
    history.push({ role: 'user', content: text });

    isTyping = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = 'auto';
    showTyping();
    showCta(false);
    errorEl.classList.remove('sai-show');

    fetch(CHAT_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        message: text,
        history: history.slice(0, -1)   /* exclude the message we just pushed */
      })
    })
      .then(function (res) {
        return res.json().then(function (data) { return { ok: res.ok, data: data }; });
      })
      .then(function (result) {
        hideTyping();
        if (!result.ok) {
          showError(result.data.message || 'Something went wrong. Please try again.');
          showCta(true);
          return;
        }
        var reply = result.data.reply || 'I\'m sorry, I couldn\'t generate a response.';
        appendBotMessage(reply);
        history.push({ role: 'assistant', content: reply });
        /* Show CTA after every bot message */
        showCta(true);
      })
      .catch(function (err) {
        hideTyping();
        console.error('[SAI Chat]', err);
        showError('Connection error. Please check your network or contact us directly.');
        showCta(true);
        /* Remove the last user history entry so they can retry */
        history.pop();
      })
      .finally(function () {
        isTyping = false;
        sendBtn.disabled = false;
        input.focus();
      });
  }

  /* ── Wire input events ───────────────────────────────── */
  sendBtn.addEventListener('click', function () {
    sendMessage(input.value);
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
    }
  });

}());
