/* Preserve the live background while replacing internal page content. */
(function () {
  'use strict';
  if (!window.fetch || location.protocol === 'file:') return;
  var pages = /\/(index|about|team|research|publications|contact|tools)\.html$/;
  var requestId = 0;
  var currentUrl = location.href;
  var positions = new Map();
  var cache = new Map();
  var transitionAnimations = [];
  function load(url) {
    var key = url.origin + url.pathname + url.search;
    if (!cache.has(key)) {
      cache.set(key, fetch(key, { credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('Page unavailable');
        return response.text();
      }).catch(function (error) { cache.delete(key); throw error; }));
    }
    return cache.get(key);
  }
  function content() { return Array.from(document.body.querySelectorAll(':scope > .hero, :scope > .page-content')); }
  function fade(elements, entering) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    transitionAnimations = elements.map(function (el) {
      return el.animate([{ opacity: entering ? 0 : 1 }, { opacity: entering ? 1 : 0 }],
        { duration: entering ? 260 : 120, easing: 'cubic-bezier(0.22,1,0.36,1)', fill: 'both' });
    });
    return Promise.all(transitionAnimations.map(function (animation) { return animation.finished.catch(function () {}); }));
  }
  history.scrollRestoration = 'manual';

  async function navigate(url, back) {
    var id = ++requestId;
    transitionAnimations.forEach(function (animation) { animation.cancel(); });
    transitionAnimations = [];
    positions.set(currentUrl, window.scrollY);
    try {
      var next = new DOMParser().parseFromString(await load(url), 'text/html');
      if (id !== requestId) return;
      if (!next.querySelector('nav') || !next.querySelector('.page-content')) throw new Error('Unsupported page');
      await fade(content(), false);
      if (id !== requestId) return;
      document.body.classList.add('has-navigated');
      // Keep the canvas and shared scripts, replacing just navigation and content.
      document.head.querySelectorAll('style').forEach(function (el) { el.remove(); });
      next.head.querySelectorAll('style').forEach(function (el) { document.head.appendChild(document.importNode(el, true)); });
      document.body.querySelectorAll(':scope > .hero, :scope > .page-content').forEach(function (el) { el.remove(); });
      var nav = document.querySelector('nav');
      nav.querySelector('.nav-links').innerHTML = next.querySelector('.nav-links').innerHTML;
      nav.querySelector('.nav-toggle').setAttribute('aria-expanded', 'false');
      var anchor = document.body.querySelector('script');
      next.body.querySelectorAll(':scope > .hero, :scope > .page-content').forEach(function (el) {
        var copy = document.importNode(el, true);
        document.body.insertBefore(copy, anchor);
      });
      document.title = next.title;
      if (!back) history.pushState(null, '', url.href);
      currentUrl = url.href;
      window.scrollTo({ top: back ? (positions.get(currentUrl) || 0) : 0, behavior: 'instant' });
      window.initializePageAnimations({ navigation: true });
      var entering = fade(content(), true);
      if (!back) {
        var heading = document.querySelector('.page-title, .hero-lab');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      }
      if (url.hash) {
        var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) target.scrollIntoView();
      }
      await entering;
      if (id !== requestId) return;
      transitionAnimations.forEach(function (animation) { animation.cancel(); });
      transitionAnimations = [];
      if (window.gtag) window.gtag('event', 'page_view', { page_title: document.title, page_location: url.href });
    } catch (error) {
      if (id === requestId) location.assign(url.href);
    }
  }
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !pages.test(url.pathname)) return;
    if (url.pathname === location.pathname && url.search === location.search) return;
    event.preventDefault();
    navigate(url, false);
  });
  function prefetch(event) {
    var link = event.target.closest('a[href]');
    if (!link || (link.target && link.target !== '_self')) return;
    var url = new URL(link.href, location.href);
    if (url.origin === location.origin && pages.test(url.pathname)) load(url).catch(function () {});
  }
  document.addEventListener('pointerover', prefetch, { passive: true });
  document.addEventListener('focusin', prefetch);
  window.addEventListener('popstate', function () { navigate(new URL(location.href), true); });
})();
