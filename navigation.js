/* Preserve the live background while replacing internal page content. */
(function () {
  'use strict';
  if (!window.fetch || location.protocol === 'file:') return;
  var pages = /\/(index|about|team|research|publications|contact|tools)\.html$/;
  var requestId = 0;
  var currentUrl = location.href;
  var positions = new Map();
  history.scrollRestoration = 'manual';

  async function navigate(url, back) {
    var id = ++requestId;
    positions.set(currentUrl, window.scrollY);
    try {
      var response = await fetch(url.href, { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Page unavailable');
      var next = new DOMParser().parseFromString(await response.text(), 'text/html');
      if (id !== requestId) return;
      if (!next.querySelector('nav') || !next.querySelector('.page-content')) throw new Error('Unsupported page');
      // Keep the canvas and shared scripts, replacing just navigation and content.
      document.head.querySelectorAll('style').forEach(function (el) { el.remove(); });
      next.head.querySelectorAll('style').forEach(function (el) { document.head.appendChild(document.importNode(el, true)); });
      document.body.querySelectorAll(':scope > nav, :scope > .hero, :scope > .page-content').forEach(function (el) { el.remove(); });
      var anchor = document.body.querySelector('script');
      next.body.querySelectorAll(':scope > nav, :scope > .hero, :scope > .page-content').forEach(function (el) {
        var copy = document.importNode(el, true);
        if (copy.classList.contains('page-content')) copy.classList.add('page-arriving');
        document.body.insertBefore(copy, anchor);
      });
      document.title = next.title;
      if (!back) history.pushState(null, '', url.href);
      currentUrl = url.href;
      window.scrollTo({ top: back ? (positions.get(currentUrl) || 0) : 0, behavior: 'instant' });
      window.initializePageAnimations();
      if (!back) {
        var heading = document.querySelector('.page-title, .hero-lab');
        if (heading) { heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true }); }
      }
      if (url.hash) {
        var target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
        if (target) target.scrollIntoView();
      }
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
  window.addEventListener('popstate', function () { navigate(new URL(location.href), true); });
})();
