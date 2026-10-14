/* ============================================================================
   嘎嘎sama — Personal Dossier · interaction layer
   No dependencies. Every module is isolated so one failure cannot break the
   rest of the page, and no module is required for content to be readable.
   ========================================================================= */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  function safe(fn) {
    try { fn(); } catch (err) {
      if (window.console && console.warn) console.warn('[dossier]', err);
    }
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ── Hero entrance ─────────────────────────────────────────────────────── */
  function markReady() { doc.body.classList.add('is-ready'); }

  /* ── Sticky header + reading progress + section spy ───────────────────────
     One rAF-throttled scroll handler drives all three, so they can never
     disagree with each other or with the real scroll position. */
  function scrollState() {
    var hdr = doc.getElementById('hdr');
    var rail = doc.getElementById('rail');
    var railNo = doc.getElementById('rail-no');
    var railName = doc.getElementById('rail-name');

    var items = [];
    var marks = doc.querySelectorAll('.nav [data-spy]');
    for (var i = 0; i < marks.length; i++) {
      var id = marks[i].getAttribute('data-spy');
      var el = doc.getElementById(id);
      if (!el) continue;
      items.push({
        id: id,
        el: el,
        link: marks[i],
        /* the readout reuses the nav label — no second copy of the names */
        label: (marks[i].textContent || '').replace(/^\s*\d+\s*/, '').trim(),
      });
    }

    var activeId = '';

    function apply() {
      var y = window.pageYOffset || root.scrollTop;
      var max = root.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;

      if (hdr) hdr.classList.toggle('is-stuck', y > 8);
      root.style.setProperty('--p', ratio.toFixed(4));
      if (rail) rail.style.setProperty('--rail-p', (ratio * 100).toFixed(2) + '%');

      /* the active chapter is the last one whose top has passed the header */
      var line = y + (hdr ? hdr.offsetHeight : 56) + 4;
      var active = items.length ? items[0] : null;
      for (var k = 0; k < items.length; k++) {
        var top = items[k].el.getBoundingClientRect().top + y;
        if (top <= line) active = items[k];
      }
      /* at the very bottom the last chapter wins, even if a short footer follows */
      if (max > 0 && y >= max - 2 && items.length) active = items[items.length - 1];

      if (active && active.id !== activeId) {
        activeId = active.id;
        for (var m = 0; m < items.length; m++) {
          if (items[m] === active) items[m].link.setAttribute('aria-current', 'true');
          else items[m].link.removeAttribute('aria-current');
        }
        if (railNo) railNo.textContent = pad(items.indexOf(active) + 1);
        if (railName) railName.textContent = active.label;
      }
    }

    var queued = false;
    function onScroll() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; apply(); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
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

    /* Safety net: an element inside the bottom 6% of the page can never satisfy
       the negative root margin, so reveal everything at the end of the document. */
    function checkEnd() {
      if (window.innerHeight + window.pageYOffset >= root.scrollHeight - 2) showAll();
    }
    window.addEventListener('scroll', function () {
      window.requestAnimationFrame(checkEnd);
    }, { passive: true });
    checkEnd();
  }

  /* ── Mobile menu: focus trap, Escape, focus restore ───────────────────── */
  function menu() {
    var burger = doc.getElementById('burger');
    var panel = doc.getElementById('menu');
    if (!burger || !panel) return;

    var closeBtn = doc.getElementById('menu-close');
    var lastFocus = null;

    function focusables() {
      return Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])'))
        .filter(function (el) { return el.offsetParent !== null || el === closeBtn; });
    }

    function open() {
      lastFocus = doc.activeElement;
      panel.hidden = false;
      burger.setAttribute('aria-expanded', 'true');
      root.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      panel.hidden = true;
      burger.setAttribute('aria-expanded', 'false');
      root.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    burger.addEventListener('click', function () {
      if (panel.hidden) open(); else close();
    });

    if (closeBtn) closeBtn.addEventListener('click', close);

    panel.addEventListener('click', function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (link) close();
    });

    doc.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var list = focusables();
      if (!list.length) return;
      var first = list[0];
      var last = list[list.length - 1];
      if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    /* If the viewport grows past the mobile breakpoint while the panel is open,
       close it — otherwise the page stays scroll-locked behind a dead overlay. */
    var wide = window.matchMedia('(min-width: 721px)');
    function onWide(e) { if (e.matches && !panel.hidden) close(); }
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ── Hero micro-parallax (deliberately tiny, pointer-fine only) ─────────── */
  function parallax() {
    var mesh = doc.querySelector('.hero__mesh');
    var ghost = doc.querySelector('.hero__ghost');
    var hero = doc.getElementById('top');
    if ((!mesh && !ghost) || !hero) return;
    if (reduceMotion.matches || !finePointer.matches) return;

    var targetX = 0;
    var targetY = 0;
    var curX = 0;
    var curY = 0;
    var frame = 0;
    var visible = true;
    var started = false;

    /* no work at all once the hero has scrolled away */
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      }, { threshold: 0 }).observe(hero);
    }

    function step() {
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      if (mesh) mesh.style.transform = 'translate3d(' + (curX * -0.5).toFixed(2) + 'px,' + (curY * -0.5).toFixed(2) + 'px,0)';
      if (ghost) ghost.style.transform = 'translate3d(' + curX.toFixed(2) + 'px,' + curY.toFixed(2) + 'px,0)';
      if (Math.abs(targetX - curX) > 0.15 || Math.abs(targetY - curY) > 0.15) {
        frame = window.requestAnimationFrame(step);
      } else {
        frame = 0;
      }
    }

    window.addEventListener('pointermove', function (e) {
      if (!started || !visible) return;
      targetX = ((e.clientX / window.innerWidth) - 0.5) * 14;
      targetY = ((e.clientY / window.innerHeight) - 0.5) * 10;
      if (!frame) frame = window.requestAnimationFrame(step);
    }, { passive: true });

    /* let the staggered entrance finish before the pointer owns the transform */
    window.setTimeout(function () { started = true; }, 1100);
  }

  /* ── Keep the copyright year current ──────────────────────────────────── */
  function year() {
    var el = doc.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  function boot() {
    window.__dossierBooted = true;
    markReady();
    safe(scrollState);
    safe(reveal);
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
