/* ============================================================
   Bao Lab — Premium Animations
   Effects: custom cursor · ambient orb · nav blur · kinetic
   title · 3-D card tilt + inner light · magnetic buttons ·
   section sweep · scroll reveal · timeline dot stagger
   ============================================================ */
(function () {
  'use strict';

  var reduced  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;

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
      if (nav && !nav.contains(e.target)) {
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
          setTimeout(function () { entry.target.style.transitionDelay = ''; }, 900);
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.07, rootMargin: '0px 0px -24px 0px' });

    function watch(el, delay) {
      if (!el) return;
      if (delay) el.style.transitionDelay = Math.min(delay, 240) + 'ms';
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

  /* Scroll work is coalesced into one update per rendered frame. */
  var heroContent = document.querySelector('.hero-content');
  var progress = document.createElement('div');
  progress.className = 'reading-progress';
  progress.setAttribute('aria-hidden', 'true');
  document.body.appendChild(progress);
  var scrollPending = false;
  function updateScroll() {
    scrollPending = false;
    var y = window.scrollY;
    var distance = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (distance > 0 ? Math.min(1, y / distance) : 0) + ')';
    if (heroContent && !reduced && !isMobile) {
      var height = heroContent.parentElement.offsetHeight;
      heroContent.style.transform = 'translateY(' + Math.min(y, height) * 0.14 + 'px)';
      heroContent.style.opacity = Math.max(0, 1 - y / height).toFixed(3);
    }
  }
  window.addEventListener('scroll', function () {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  window.addEventListener('resize', updateScroll);
  window.addEventListener('pageshow', updateScroll);
  updateScroll();

})();
