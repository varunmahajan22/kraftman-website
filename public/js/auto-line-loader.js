/* ═══════════════════════════════════════════════════════════════════
   Loads the homepage's 3D pieces — the automatic-line scene and the
   construction clips in the box-style cards — only as they near the
   viewport, so Three.js never delays the first paint of the homepage.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Construction clips in the box-style cards: each is a story page in clip
  // mode. Give an iframe its address only when its card nears the viewport.
  var clips = document.querySelectorAll('.boxstyle-clip iframe[data-src]');
  var startClip = function (frame) { frame.src = frame.getAttribute('data-src'); frame.removeAttribute('data-src'); };
  if ('IntersectionObserver' in window) {
    var clipObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { clipObserver.unobserve(e.target); startClip(e.target); }
      });
    }, { rootMargin: '300px 0px' });
    Array.prototype.forEach.call(clips, function (frame) { clipObserver.observe(frame); });
  } else {
    Array.prototype.forEach.call(clips, startClip);
  }

  var section = document.getElementById('autoline');
  if (!section) return;

  var SCRIPTS = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
    '/js/line-operator.js?v=1',
    '/js/auto-line.js?v=9'
  ];
  var started = false;

  function load() {
    if (started) return;
    started = true;
    (function next(i) {
      if (i >= SCRIPTS.length) return;
      var s = document.createElement('script');
      s.src = SCRIPTS[i];
      s.onload = function () { next(i + 1); };
      document.body.appendChild(s);
    })(0);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries, observer) {
      if (entries[0].isIntersecting) { observer.disconnect(); load(); }
    }, { rootMargin: '700px 0px' }).observe(section);
  } else {
    load();
  }
})();
