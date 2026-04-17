/* ============================================================
   Bao Lab — Premium Animations
   Effects: custom cursor · ambient orb · nav blur · kinetic
   title · 3-D card tilt + inner light · magnetic buttons ·
   section sweep · scroll reveal · timeline dot stagger
   ============================================================ */
(function () {
  'use strict';

  var reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  /* ────────────────────────────────────────────────────────
     1.  AMBIENT CURSOR ORB  (desktop only)
  ──────────────────────────────────────────────────────── */
  if (!reduced && !isMobile) {
    var orb = document.createElement('div');
    orb.className = 'ambient-orb';
    document.body.appendChild(orb);

    document.addEventListener('mousemove', function (e) {
      /* orb lags behind via CSS transition on transform */
      orb.style.transform =
        'translate(' + (e.clientX - 320) + 'px,' + (e.clientY - 320) + 'px)';
    });
  }

  /* ────────────────────────────────────────────────────────
     2.  MOBILE HAMBURGER MENU
  ──────────────────────────────────────────────────────── */
  var toggle   = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    /* close menu when a link is tapped */
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    /* close on outside tap */
    document.addEventListener('click', function (e) {
      if (!nav.contains(e.target)) {
        navLinks.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ────────────────────────────────────────────────────────
     3.  NAV BLUR ON SCROLL
  ──────────────────────────────────────────────────────── */
  var nav = document.querySelector('nav');
  if (nav) {
    function updateNav() {
      nav.classList.toggle('scrolled', window.scrollY > 24);
    }
    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
  }

  /* ────────────────────────────────────────────────────────
     4.  KINETIC PAGE TITLE  (word-by-word slide-up)
  ──────────────────────────────────────────────────────── */
  if (!reduced) {
    var titleEl = document.querySelector('.page-title');
    if (titleEl && titleEl.children.length === 0) {
      /* only plain-text titles */
      titleEl.style.cssText = 'animation:none; opacity:1;';
      var words = titleEl.textContent.trim().split(/\s+/);
      titleEl.innerHTML = words.map(function (w) {
        return '<span class="word-wrap"><span class="word-inner">'
             + w + '</span></span>';
      }).join('\u00a0'); /* non-breaking space between spans */

      /* stagger reveal */
      setTimeout(function () {
        titleEl.querySelectorAll('.word-inner').forEach(function (s, i) {
          setTimeout(function () { s.classList.add('shown'); }, i * 90);
        });
      }, 60);
    }
  }

  /* ────────────────────────────────────────────────────────
     5.  SCROLL REVEAL  (IntersectionObserver)
  ──────────────────────────────────────────────────────── */
  if (!reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' });

    function watch(el, delay) {
      if (!el) return;
      if (delay) el.style.transitionDelay = delay + 'ms';
      el.classList.add('reveal');
      io.observe(el);
    }
    function watchList(list, step, base) {
      Array.prototype.forEach.call(list, function (el, i) {
        watch(el, (base || 0) + i * (step || 70));
      });
    }

    /* --- per-page targets --- */

    /* section labels (sweep driven by CSS .visible::after) */
    watchList(document.querySelectorAll('.section-label'), 55);

    /* intro paragraphs */
    watchList(document.querySelectorAll('.page-content > p'), 40);

    /* home grid */
    watchList(document.querySelectorAll('.home-grid .home-card'), 78);

    /* team */
    watchList(document.querySelectorAll('.pi-card'), 0);
    watchList(document.querySelectorAll('.member-year'), 92);
    watchList(document.querySelectorAll('.member-card'), 55);

    /* research */
    watchList(document.querySelectorAll('.card'), 70);

    /* publications — grouped per year section */
    var pubLabels = document.querySelectorAll('.section-label');
    if (pubLabels.length) {
      pubLabels.forEach(function (label) {
        var group = [], sib = label.nextElementSibling;
        while (sib && !sib.classList.contains('section-label')
                    && !sib.classList.contains('scholar-note')) {
          if (sib.classList.contains('pub-card')) group.push(sib);
          sib = sib.nextElementSibling;
        }
        group.forEach(function (c, i) { watch(c, i * 42); });
      });
    }
    watchList(document.querySelectorAll('.scholar-note'), 0);

    /* about — timeline items */
    watchList(document.querySelectorAll('.tl-item'), 80);

    /* about — grant & award rows */
    watchList(document.querySelectorAll('.grant-card'), 65);
    watchList(document.querySelectorAll('.award-list li'), 40);

    /* contact */
    watchList(document.querySelectorAll('.contact-item'), 70);

    /* tools */
    watchList(document.querySelectorAll('.tool-card'), 70);
  }

  /* ────────────────────────────────────────────────────────
     6.  3-D CARD TILT  +  INNER RADIAL LIGHT
         (mouse-over radial gradient follows cursor inside card)
  ──────────────────────────────────────────────────────── */
  if (!reduced && !isMobile) {
    var tiltTargets = [
      '.card', '.home-card', '.student-card',
      '.pi-card', '.member-card', '.contact-item', '.grant-card'
    ];

    document.querySelectorAll(tiltTargets.join(',')).forEach(function (el) {
      var maxDeg = el.classList.contains('pi-card') ? 4 : 7;

      el.addEventListener('mouseenter', function () {
        el.style.transition =
          'transform 0.10s, box-shadow 0.22s, border-color 0.2s, background-color 0.2s';
      });

      el.addEventListener('mousemove', function (e) {
        var r   = el.getBoundingClientRect();
        var dx  = (e.clientX - (r.left + r.width  / 2)) / (r.width  / 2);
        var dy  = (e.clientY - (r.top  + r.height / 2)) / (r.height / 2);
        var rX  = (-dy * maxDeg).toFixed(2);
        var rY  = ( dx * maxDeg).toFixed(2);

        el.style.transform =
          'perspective(960px) rotateX(' + rX + 'deg) rotateY(' + rY + 'deg) scale(1.022)';

        /* inner radial glow at mouse position */
        var lx = (e.clientX - r.left).toFixed(1);
        var ly = (e.clientY - r.top ).toFixed(1);
        el.style.backgroundImage =
          'radial-gradient(520px circle at ' + lx + 'px ' + ly + 'px,' +
          'rgba(0,196,238,0.055),transparent 42%)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transition =
          'transform 0.6s cubic-bezier(0.22,1,0.36,1),' +
          'box-shadow 0.28s, border-color 0.2s, background-color 0.2s';
        el.style.transform       = '';
        el.style.backgroundImage = '';
      });
    });

    /* pub-card: inner light only (no tilt — too many items) */
    document.querySelectorAll('.pub-card').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r  = el.getBoundingClientRect();
        var lx = (e.clientX - r.left).toFixed(1);
        var ly = (e.clientY - r.top ).toFixed(1);
        el.style.backgroundImage =
          'radial-gradient(420px circle at ' + lx + 'px ' + ly + 'px,' +
          'rgba(0,196,238,0.04),transparent 45%)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.backgroundImage = '';
      });
    });
  }

  /* ────────────────────────────────────────────────────────
     7.  MAGNETIC BUTTONS  (hero CTAs + pi-links)
  ──────────────────────────────────────────────────────── */
  if (!reduced && !isMobile) {
    document.querySelectorAll('.btn, .pi-link').forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        btn.style.transition =
          'transform 0.12s, background 0.2s, border-color 0.2s, box-shadow 0.22s';
      });
      btn.addEventListener('mousemove', function (e) {
        var r  = btn.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width  / 2)) * 0.26;
        var dy = (e.clientY - (r.top  + r.height / 2)) * 0.26;
        btn.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () {
        btn.style.transition =
          'transform 0.5s cubic-bezier(0.22,1,0.36,1),' +
          'background 0.2s, border-color 0.2s, box-shadow 0.22s';
        btn.style.transform = '';
      });
    });
  }

  /* ────────────────────────────────────────────────────────
     8.  TIMELINE DOT STAGGER  (about.html)
         Each dot pulses at a different phase so they don't
         all blink in sync.
  ──────────────────────────────────────────────────────── */
  document.querySelectorAll('.tl-dot').forEach(function (dot, i) {
    dot.style.animationDelay = (i * 0.45) + 's';
  });

  /* members-timeline dots are handled by CSS animation on ::after */
  document.querySelectorAll('.member-year-label').forEach(function (el, i) {
    /* stagger the pulse phase per year row */
    var pseudo = el; /* ::after phase is inherited via animation-delay on the element */
    pseudo.style.setProperty('--pulse-delay', (i * 0.6) + 's');
  });

  /* ────────────────────────────────────────────────────────
     9.  HERO PARALLAX  (index.html — hero-content drifts up
         at ~25 % of scroll speed for a depth effect)
  ──────────────────────────────────────────────────────── */
  if (!reduced && !isMobile) {
    var heroContent = document.querySelector('.hero-content');
    var heroCanvas  = document.querySelector('#hero-canvas');
    if (heroContent) {
      window.addEventListener('scroll', function () {
        var y = window.scrollY;
        heroContent.style.transform = 'translateY(' + (y * 0.25).toFixed(1) + 'px)';
        heroContent.style.opacity   = Math.max(0, 1 - y / 420).toFixed(3);
        if (heroCanvas) {
          heroCanvas.style.transform = 'translateY(' + (y * 0.10).toFixed(1) + 'px)';
        }
      }, { passive: true });
    }
  }

})();
