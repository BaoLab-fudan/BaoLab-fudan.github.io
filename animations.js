/* ============================================================
   Bao Lab — Scroll-reveal & stagger animations
   Uses IntersectionObserver; respects prefers-reduced-motion
   ============================================================ */
(function () {
  'use strict';

  // Bail out immediately if the user prefers less motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ── IntersectionObserver ── */
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          io.unobserve(entry.target); // fire once
        }
      });
    },
    { threshold: 0.08, rootMargin: '0px 0px -28px 0px' }
  );

  /* ── Helper: mark an element for reveal with optional delay ── */
  function watch(el, delayMs) {
    if (!el) return;
    if (delayMs) el.style.transitionDelay = delayMs + 'ms';
    el.classList.add('reveal');
    io.observe(el);
  }

  /* ── Helper: stagger a NodeList by a fixed interval ── */
  function watchList(list, intervalMs, baseDelayMs) {
    Array.prototype.forEach.call(list, function (el, i) {
      watch(el, (baseDelayMs || 0) + i * (intervalMs || 70));
    });
  }

  /* ── Main init ── */
  function init() {

    /* Section labels — slide-fade */
    watchList(document.querySelectorAll('.section-label'), 60);

    /* ── index.html — home grid cards ── */
    watchList(document.querySelectorAll('.home-grid .home-card'), 80);

    /* ── team.html ── */
    // PI card
    watchList(document.querySelectorAll('.pi-card'), 0);

    // Each member-year row (label + cards together)
    watchList(document.querySelectorAll('.member-year'), 95);

    // Join-us cards
    watchList(document.querySelectorAll('.member-card'), 60);

    /* ── research.html — .card elements ── */
    watchList(document.querySelectorAll('.card'), 72);

    /* ── publications.html — .pub-card elements (many, short interval) ── */
    // Group by section: reset stagger counter at each year heading
    var pubGroups = document.querySelectorAll('.section-label');
    if (pubGroups.length > 0) {
      pubGroups.forEach(function (label) {
        // Collect all .pub-card elements between this label and the next
        var cards = [];
        var next = label.nextElementSibling;
        while (next && !next.classList.contains('section-label') && !next.classList.contains('scholar-note')) {
          if (next.classList.contains('pub-card')) cards.push(next);
          next = next.nextElementSibling;
        }
        cards.forEach(function (card, i) {
          watch(card, i * 50);
        });
      });
    }

    /* ── about.html / contact.html / tools.html — generic .card ── */
    // Already caught by .card above; also catch standalone .scholar-note
    watchList(document.querySelectorAll('.scholar-note'), 0);

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
