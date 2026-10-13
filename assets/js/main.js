/* ============================================================================
   嘎嘎sama — Personal Dossier · interaction layer
   No dependencies. Every module is isolated so one failure cannot break the
   rest of the page, and no module is required for content to be readable.
   ========================================================================= */
(function () {
  'use strict';

  var doc = document;
  var body = doc.body;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function safe(fn) {
    try { fn(); } catch (err) {
      if (window.console && console.warn) console.warn('[dossier]', err);
    }
  }

  /* ── Hero entrance ─────────────────────────────────────────────────────── */
  function markReady() { body.classList.add('is-ready'); }

  /* ── Sticky header state ───────────────────────────────────────────────── */
  function headerState() {
    var hdr = doc.getElementById('hdr');
    if (!hdr) return;
    var queued = false;
    function apply() {
      hdr.classList.toggle('is-stuck', window.scrollY > 8);
      queued = false;
    }
    window.addEventListener('scroll', function () {
      if (!queued) { queued = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  }

  /* ── Scroll reveal for tiles and section headers ───────────────────────── */
  function reveal() {
    var items = doc.querySelectorAll('.rv');
    if (!items.length) return;
    var list = Array.prototype.slice.call(items);

    function showAll() {
      list.forEach(function (el) { el.classList.add('is-in'); });
    }

    if (!('IntersectionObserver' in window)) { showAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

    list.forEach(function (el) { io.observe(el); });

    /* Safety net: an element that sits inside the bottom 6% of the page can never
       satisfy the negative root margin, so reveal everything once the reader
       reaches the end of the document. */
    function checkEnd() {
      var de = doc.documentElement;
      if (window.innerHeight + window.scrollY >= de.scrollHeight - 2) showAll();
    }
    var queued = false;
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; checkEnd(); });
    }, { passive: true });
    checkEnd();
  }

  /* ── Section spy: keeps the rail and the nav honest ───────────────────── */
  function spy() {
    var marks = doc.querySelectorAll('[data-spy]');
    if (!marks.length || !('IntersectionObserver' in window)) return;

    var sections = [];
    var seen = {};
    for (var i = 0; i < marks.length; i++) {
      var id = marks[i].getAttribute('data-spy');
      if (seen[id]) continue;
      var el = doc.getElementById(id);
      if (el) { seen[id] = true; sections.push(el); }
    }
    if (!sections.length) return;

    function setActive(id) {
      for (var k = 0; k < marks.length; k++) {
        if (marks[k].getAttribute('data-spy') === id) {
          marks[k].setAttribute('aria-current', 'true');
        } else {
          marks[k].removeAttribute('aria-current');
        }
      }
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) setActive(entry.target.id);
      });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    sections.forEach(function (el) { io.observe(el); });
  }

  /* ── Mobile menu ───────────────────────────────────────────────────────── */
  function menu() {
    var burger = doc.getElementById('burger');
    var panel = doc.getElementById('menu');
    var closeBtn = doc.getElementById('menu-close');
    if (!burger || !panel) return;

    function open() {
      panel.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      doc.documentElement.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }
    function shut(refocus) {
      panel.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      doc.documentElement.style.overflow = '';
      if (refocus !== false) burger.focus();
    }

    burger.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', function () { shut(); });

    /* close after following an in-page link */
    panel.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a[href^="#"]') : null;
      if (link) shut(false);
    });

    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !panel.hidden) shut();
      if (event.key !== 'Tab' || panel.hidden) return;
      var focusables = panel.querySelectorAll('a[href], button');
      if (!focusables.length) return;
      var first = focusables[0];
      var last = focusables[focusables.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    /* if the viewport grows past the breakpoint while open, reset cleanly */
    var wide = window.matchMedia('(min-width: 721px)');
    var onWide = function (event) { if (event.matches && !panel.hidden) shut(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ── Pointer parallax on the oversized wordmark (bounded, hero only) ───── */
  function parallax() {
    var ghost = doc.querySelector('.hero__ghost');
    var hero = doc.getElementById('top');
    if (!ghost || !hero) return;
    if (reduceMotion.matches || !finePointer.matches) return;

    var targetX = 0, targetY = 0, curX = 0, curY = 0, frame = 0, visible = true;

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0 }).observe(hero);
    }

    function step() {
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      ghost.style.transform = 'translate3d(' + curX.toFixed(2) + 'px,' + curY.toFixed(2) + 'px,0)';
      if (Math.abs(targetX - curX) > 0.15 || Math.abs(targetY - curY) > 0.15) {
        frame = window.requestAnimationFrame(step);
      } else {
        frame = 0;
      }
    }

    window.addEventListener('pointermove', function (event) {
      if (!visible) return;
      targetX = (event.clientX / window.innerWidth - 0.5) * 14;
      targetY = (event.clientY / window.innerHeight - 0.5) * 10;
      if (!frame) frame = window.requestAnimationFrame(step);
    }, { passive: true });
  }

  /* ── Keep the copyright year current ──────────────────────────────────── */
  function year() {
    var el = doc.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function boot() {
    markReady();
    safe(headerState);
    safe(reveal);
    safe(spy);
    safe(menu);
    safe(parallax);
    safe(year);
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', function () {
      window.requestAnimationFrame(boot);
    });
  } else {
    window.requestAnimationFrame(boot);
  }

  /* Safety net: if anything above throws before boot(), the hero still shows. */
  window.setTimeout(markReady, 1400);
})();
