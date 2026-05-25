/* =========================================================
   SelectAI — main.js
   ========================================================= */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── Navbar scroll effect ─────────────────────────────────
  const navbar = document.getElementById('navbar');
  const scrollProgress = document.querySelector('.scroll-progress');

  function handleNavScroll() {
    if (window.scrollY > 60) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleNavScroll, { passive: true });
  handleNavScroll();

  // ── Back-to-top button ───────────────────────────────────
  const backTop = document.getElementById('backTop');

  function handleBackTop() {
    if (window.scrollY > 500) {
      backTop.classList.add('show');
    } else {
      backTop.classList.remove('show');
    }
  }
  window.addEventListener('scroll', handleBackTop, { passive: true });

  // ── RAF-driven scroll effects (progress + section depth) ─────────
  var ticking = false;
  var motionSections = Array.prototype.slice.call(document.querySelectorAll('.motion-section'));

  function updateScrollEffects() {
    var doc = document.documentElement;
    var scrollable = Math.max(doc.scrollHeight - window.innerHeight, 1);
    var progress = Math.min(window.scrollY / scrollable, 1);

    if (scrollProgress) {
      scrollProgress.style.transform = 'scaleX(' + progress + ')';
    }

    if (!prefersReducedMotion) {
      motionSections.forEach(function (section) {
        var rect = section.getBoundingClientRect();
        var speed = parseFloat(section.dataset.parallaxSpeed || '0.06');
        var viewportCenter = window.innerHeight * 0.5;
        var sectionCenter = rect.top + rect.height * 0.5;
        var distance = sectionCenter - viewportCenter;
        var offset = Math.max(Math.min(distance * -speed * 0.08, 14), -14);
        var inViewRatio = 1 - Math.min(Math.abs(distance) / (window.innerHeight * 0.9), 1);
        section.style.setProperty('--section-offset', offset.toFixed(2) + 'px');
        section.style.setProperty('--section-glow', Math.max(inViewRatio, 0).toFixed(2));
      });
    }

    ticking = false;
  }

  function onScrollRaf() {
    if (!ticking) {
      requestAnimationFrame(updateScrollEffects);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScrollRaf, { passive: true });
  window.addEventListener('resize', onScrollRaf);
  onScrollRaf();

  // ── Smooth scroll for all anchor links ──────────────────
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      // Close mobile menu first
      closeMobileMenu();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ── Mobile hamburger menu ────────────────────────────────
  var hamburger = document.getElementById('hamburger');
  var navLinks  = document.getElementById('navLinks');

  function closeMobileMenu() {
    hamburger.classList.remove('open');
    navLinks.classList.remove('open');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', function () {
    var isOpen = hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close menu when clicking outside
  document.addEventListener('click', function (e) {
    if (
      navLinks.classList.contains('open') &&
      !navLinks.contains(e.target) &&
      !hamburger.contains(e.target)
    ) {
      closeMobileMenu();
    }
  });

  // ── Intersection Observer — scroll-in animations ─────────
  var observerOptions = {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  };

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Unobserve after first animation to free resources
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.animate-on-scroll').forEach(function (el) {
    observer.observe(el);
  });

  // ── Magnetic button interaction (desktop only) ───────────────────
  if (!prefersReducedMotion) {
    document.querySelectorAll('.btn').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var rect = btn.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        btn.style.transform = 'translate(' + (x * 0.12).toFixed(2) + 'px,' + (y * 0.14).toFixed(2) + 'px)';
      });

      btn.addEventListener('mouseleave', function () {
        btn.style.transform = '';
      });
    });
  }

  // ── Animated counter (staggered node-map pulse) ──────────
  // Each .nm-node already animates via CSS keyframes.
  // This script refreshes the animation on hover for interactivity.
  document.querySelectorAll('.nm-node').forEach(function (node) {
    node.addEventListener('mouseenter', function () {
      node.style.animationPlayState = 'paused';
      node.style.boxShadow = '0 0 30px rgba(0,229,255,0.8)';
    });
    node.addEventListener('mouseleave', function () {
      node.style.animationPlayState = '';
      node.style.boxShadow = '';
    });
  });

  // ── Play-button hover ripple (video cards) ───────────────
  document.querySelectorAll('.play-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      // Ripple feedback — visual only (no actual video embed)
      var ripple = document.createElement('span');
      ripple.style.cssText = [
        'position:absolute',
        'border-radius:50%',
        'width:80px',
        'height:80px',
        'background:rgba(255,255,255,0.25)',
        'pointer-events:none',
        'transform:scale(0)',
        'animation:rippleAnim .5s ease forwards'
      ].join(';');
      btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(function () { ripple.remove(); }, 520);

      var videoUrl = btn.dataset.videoUrl;
      if (videoUrl) {
        window.open(videoUrl, '_blank', 'noopener,noreferrer');
      }
    });
  });

  // Inject ripple keyframe once
  var style = document.createElement('style');
  style.textContent = '@keyframes rippleAnim{to{transform:scale(3);opacity:0}}';
  document.head.appendChild(style);

  // ── Parallax tilt on capability cards ───────────────────
  document.querySelectorAll('.cap-card').forEach(function (card) {
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width - 0.5;
      var y = (e.clientY - rect.top)  / rect.height - 0.5;
      card.style.transform = [
        'translateY(-5px)',
        'rotateY(' + (x * 6) + 'deg)',
        'rotateX(' + (-y * 6) + 'deg)'
      ].join(' ');
    });
    card.addEventListener('mouseleave', function () {
      card.style.transform = '';
    });
  });

  // ── Gradient orb subtle mouse parallax on hero ──────────
  var hero = document.querySelector('.hero');
  if (hero && !prefersReducedMotion) {
    document.addEventListener('mousemove', function (e) {
      var mx = (e.clientX / window.innerWidth  - 0.5) * 20;
      var my = (e.clientY / window.innerHeight - 0.5) * 20;
      var orb1 = document.querySelector('.orb-1');
      var orb2 = document.querySelector('.orb-2');
      if (orb1) orb1.style.transform = 'translate(' + mx + 'px,' + my + 'px)';
      if (orb2) orb2.style.transform = 'translate(' + (-mx) + 'px,' + (-my) + 'px)';
    }, { passive: true });
  }

  // ── Hero title stagger entrance ──────────────────────────
  var heroSpans = document.querySelectorAll('.ht-sub, .ht-main, .ht-accent');
  heroSpans.forEach(function (span, i) {
    span.style.opacity = '0';
    span.style.transform = 'translateY(30px)';
    span.style.transition = 'opacity .8s ease, transform .8s ease';
    span.style.transitionDelay = (0.2 + i * 0.18) + 's';
    // Trigger after a short delay so CSS has settled
    requestAnimationFrame(function () {
      setTimeout(function () {
        span.style.opacity = '';
        span.style.transform = '';
      }, 100);
    });
  });

  // ── Dynamic metric-driven widget sizing ──────────────────
  function initMetricWidgets() {

    // Cap cards — scale icon, card height, progress bar fill
    document.querySelectorAll('.cap-card[data-metric]').forEach(function (card) {
      var metric = parseFloat(card.dataset.metric) || 0;
      var max    = parseFloat(card.dataset.max)    || 100;
      var pct    = Math.min(metric / max, 1);
      card.style.setProperty('--icon-sz',      Math.round(44 + pct * 32)           + 'px');
      card.style.setProperty('--icon-svg-sz',  Math.round(22 + pct * 16)           + 'px');
      card.style.setProperty('--card-extra-h', Math.round(pct * 70)                + 'px');
      card.style.setProperty('--card-pt',      (1.6 + pct * 1.4).toFixed(2)        + 'rem');
      card.style.setProperty('--bar-pct',      (pct * 100).toFixed(1)              + '%');
    });

    // Video cards — thumbnail height
    document.querySelectorAll('.video-card[data-metric]').forEach(function (card) {
      var metric = parseFloat(card.dataset.metric) || 0;
      var max    = parseFloat(card.dataset.max)    || 100;
      var pct    = Math.min(metric / max, 1);
      card.style.setProperty('--thumb-h', Math.round(145 + pct * 80) + 'px');
    });

    // Team cards — avatar size
    document.querySelectorAll('.team-card[data-metric]').forEach(function (card) {
      var metric = parseFloat(card.dataset.metric) || 0;
      var max    = parseFloat(card.dataset.max)    || 10;
      var pct    = Math.min(metric / max, 1);
      card.style.setProperty('--av-sz', Math.round(80 + pct * 40) + 'px');
    });

    // Partner card — logo size
    document.querySelectorAll('.partner-card[data-metric]').forEach(function (card) {
      var metric = parseFloat(card.dataset.metric) || 0;
      var max    = parseFloat(card.dataset.max)    || 100;
      var pct    = Math.min(metric / max, 1);
      card.style.setProperty('--logo-sz', Math.round(68 + pct * 36) + 'px');
    });

    // Animate counters up when card enters viewport
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var card  = entry.target;
        var numEl = card.querySelector('.cap-stat-num, .vid-stat-num');
        if (!numEl) { counterObs.unobserve(card); return; }
        var target   = parseFloat(card.dataset.metric) || 0;
        var isFloat  = (target !== Math.floor(target));
        var duration = 1500;
        var startTs  = null;
        requestAnimationFrame(function step(ts) {
          if (!startTs) startTs = ts;
          var progress = Math.min((ts - startTs) / duration, 1);
          var eased    = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          var current  = eased * target;
          numEl.textContent = isFloat ? current.toFixed(1) : Math.round(current);
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            numEl.textContent = isFloat ? target.toFixed(1) : target;
          }
        });
        counterObs.unobserve(card);
      });
    }, { threshold: 0.35 });

    document.querySelectorAll('[data-metric]').forEach(function (card) {
      if (card.querySelector('.cap-stat-num, .vid-stat-num')) {
        counterObs.observe(card);
      }
    });
  }

  initMetricWidgets();

}());
