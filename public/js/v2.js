/* ═══════════════════════════════════════════════════════════════════
   Kraftman Packaging — behaviour for every page of the site

   Behaviour only. All content is already in the HTML: the server writes
   it (lib/render.js) so search engines and AI assistants can read it
   without running this script. Each part looks for its own elements, so
   the same file serves the homepage and the inner pages. The hero scene
   and the construction clip are loaded by auto-line-loader.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  /* ── Header, menu, quick actions, progress ─────────────────────── */
  const header = $('v2Header'), burger = $('v2Burger'), menu = $('v2Menu');
  const rail = $('v2Rail'), railToggle = $('v2RailToggle'), progress = $('v2Progress');
  const hero = $('autoline');

  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.setAttribute('aria-hidden', String(!open));
  }
  burger.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  let railPinned = false;                     // true once the visitor has used the toggle
  function setRail(closed) {
    rail.classList.toggle('is-closed', closed);
    railToggle.setAttribute('aria-expanded', String(!closed));
    railToggle.setAttribute('aria-label', closed ? 'Show quick actions' : 'Hide quick actions');
  }
  railToggle.addEventListener('click', () => { railPinned = true; setRail(!rail.classList.contains('is-closed')); });

  function onScroll() {
    // Past the hero the header turns solid and the quick actions tuck away,
    // so they never sit on top of the page's own content.
    const pastHero = hero ? window.scrollY > hero.offsetHeight - header.offsetHeight : true;   // inner pages have no hero to sit beside
    if (hero) header.classList.toggle('is-solid', pastHero);
    if (!railPinned) setRail(pastHero);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleY(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0) + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ── Tabs: pick an item, its body opens and the picture swaps ───── */
  function tabs(list, onPick) {
    list.addEventListener('click', e => {
      const button = e.target.closest('button');
      if (!button) return;
      const item = button.parentElement;
      if (item.classList.contains('is-active')) return;
      Array.prototype.forEach.call(list.children, li => li.classList.toggle('is-active', li === item));
      onPick(item);
    });
  }

  // Rigid box styles: the picture is that style's construction clip.
  const styleClip = $('v2StyleClip');
  if ($('v2Styles')) tabs($('v2Styles'), item => {
    styleClip.removeAttribute('data-src');          // the loader no longer needs to start it
    styleClip.title = item.getAttribute('data-name') + ' rigid box being made';
    styleClip.src = item.getAttribute('data-clip') + '?clip=1';
  });

  // Capabilities: the picture is that capability's photo, where it has one.
  const capImage = $('v2CapImage');
  if ($('v2Caps')) tabs($('v2Caps'), item => {
    const url = item.getAttribute('data-image');
    if (!capImage || !url) return;
    capImage.classList.add('is-swapping');
    setTimeout(() => {
      capImage.src = url;
      capImage.alt = item.querySelector('button').lastChild.textContent.trim() + ' at Kraftman Packaging';
      capImage.classList.remove('is-swapping');
    }, 250);
  });

  /* ── Enquiry forms ─────────────────────────────────────────────── */
  Array.prototype.forEach.call(document.querySelectorAll('form[data-enquiry]'), form => {
    const note = form.querySelector('.v2-form-note');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const say = (text, isError) => { note.textContent = text; note.classList.toggle('is-error', !!isError); };
      if (!data.name || !data.email || !data.message) return say('Please fill in your name, email and what you need.', true);
      const button = form.querySelector('button');
      button.disabled = true;
      say('Sending…');
      fetch('/api/enquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(r => r.json().then(body => ({ ok: r.ok, body })))
        .then(res => {
          if (!res.ok) return say(res.body.error || 'Could not send your enquiry. Please call us instead.', true);
          form.reset();
          say('Thank you. We have your enquiry and will reply within one working day.');
        })
        .catch(() => say('Could not send your enquiry. Please call us instead.', true))
        .then(() => { button.disabled = false; });
    });
  });

  if ($('v2Year')) $('v2Year').textContent = new Date().getFullYear();
})();
