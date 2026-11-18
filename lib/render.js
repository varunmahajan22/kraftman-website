/**
 * Turns the site's content into pages.
 *
 *   renderHome(preview)       the homepage, from views/home.html
 *   renderPage(path, preview) any other page, or null if there is none
 *   renderNotFound()          the 404 page
 *   siteMap()                 every public page, for sitemap.xml and llms.txt
 *
 * The words come from lib/store.js: the defaults in lib/content.js with the
 * marketing team's published edits over them (or their draft, in a preview).
 */
const fs = require('fs');
const path = require('path');
const { SITE_URL, esc, rich, tel, context, layout } = require('./site');
const store = require('./store');

const HOME = path.join(__dirname, '..', 'views', 'home.html');
const num = i => String(i + 1).padStart(2, '0');
const more = (href, label) => '<a class="v2-link" href="' + href + '">' + esc(label) + ' <span>&nearr;</span></a>';

/* ── Placeholders and conditions ────────────────────────────────────── */
function resolver(ctx) {
  const values = {
    address: ctx.address, email: ctx.email, phone: ctx.phones[0] || '',
    certifications: ctx.credentials,
    certified: ctx.credentials ? 'Kraftman Packaging is ' + ctx.credentials + '.' : '',
    'certification-details': ctx.certs.map(c => c.body).join(' '),
  };
  const fill = s => String(s == null ? '' : s).replace(/\{([a-z-]+)\}/g, (m, k) => (k in values ? values[k] : m)).replace(/\s{2,}/g, ' ').trim();
  const allowed = needs => !needs || (needs === 'certs' ? ctx.certs.length > 0 : ctx.certs.some(c => c.title.toLowerCase().indexOf(needs.slice(5)) === 0));
  const pairs = rows => rows.map(r => r.map((c, i) => (i < 2 ? fill(c) : c)));
  // A page with every placeholder filled in and every part that needs a hidden certification dropped.
  return page => Object.assign({}, page, {
    title: fill(page.title), description: fill(page.description), h1: fill(page.h1), lead: fill(page.lead),
    sections: page.sections.filter(s => allowed(s.needs)).map(s => Object.assign({}, s, {
      h2: fill(s.h2), intro: s.intro ? fill(s.intro) : '', after: s.after ? fill(s.after) : '',
      paras: s.paras && s.paras.map(fill), bullets: s.bullets && s.bullets.map(fill),
      rows: s.rows && pairs(s.rows), steps: s.steps && pairs(s.steps), facts: s.facts && pairs(s.facts),
      table: s.table && { head: s.table.head, rows: s.table.rows.map(r => r.map(fill)) },
    })),
    faqs: page.faqs.filter(f => allowed(f.needs)).map(f => ({ q: fill(f.q), a: fill(f.a) })),
    cta: page.cta && Object.assign({}, page.cta, { h2: fill(page.cta.h2), p: fill(page.cta.p) }),
  });
}

/* ── Shared pieces ──────────────────────────────────────────────────── */
const faqList = faqs => faqs.map(f => '<details><summary>' + esc(f.q) + '</summary><p>' + rich(f.a) + '</p></details>').join('\n        ');
const contactList = ctx =>
  '<address><ul class="v2-contact-list">' +
    '<li><span>Phone</span><div>' + ctx.phones.map(p => '<a href="' + esc(tel(p)) + '">' + esc(p) + '</a>').join('') + '</div></li>' +
    (ctx.email ? '<li><span>Email</span><div><a href="mailto:' + esc(ctx.email) + '">' + esc(ctx.email) + '</a></div></li>' : '') +
    '<li><span>Plant</span><div>Kraftman Packaging Private Limited, ' + esc(ctx.address) +
      '<a class="v2-map" href="https://www.google.com/maps/search/?api=1&amp;query=' + encodeURIComponent('Kraftman Packaging, Janoli, Palwal, Haryana') + '" target="_blank" rel="noopener">Open in Google Maps &nearr;</a></div></li>' +
  '</ul></address>';
const enquiryForm = () => `<form class="v2-form" data-enquiry novalidate>
        <label>Name<input name="name" type="text" autocomplete="name" required /></label>
        <label>Email<input name="email" type="email" autocomplete="email" required /></label>
        <label>Phone<input name="phone" type="tel" autocomplete="tel" /></label>
        <label>Company<input name="company" type="text" autocomplete="organization" /></label>
        <label class="wide">What do you need?<textarea name="message" rows="4" required></textarea></label>
        <button class="v2-btn" type="submit">Send enquiry <span>&nearr;</span></button>
        <p class="v2-form-note" role="status" aria-live="polite"></p>
      </form>`;
const familyTiles = () => '<div class="v2-tiles">' + store.families().map(f =>
  '<a class="v2-tile" href="' + f.href + '">' + (f.photo ? '<img src="' + esc(f.photo.url) + '" alt="' + esc(f.name + ' by Kraftman Packaging') + '" loading="lazy" onerror="this.remove()" />' : '') +
  '<h3>' + esc(f.name) + '</h3><p>' + esc(f.blurb) + '</p><span class="v2-link">View <span>&nearr;</span></span></a>').join('') + '</div>';
const certList = ctx => ctx.certs.map(c =>
  '<li>' + (c.image_url ? '<img src="' + esc(c.image_url) + '" alt="' + esc(c.title) + ' logo" loading="lazy" onerror="this.remove()" />' : '') +
  '<div><h3>' + esc(c.title) + '</h3><p>' + esc(c.body) + '</p></div></li>').join('\n        ');
// Photographs from the galleries: one family's, or every family's.
function galleryItems(slug) {
  return store.families().filter(f => !slug || f.slug === slug)
    .reduce((all, f) => all.concat(f.gallery.filter(g => g.active && g.image).map(g => ({ family: f.name, image: g.image.url, caption: g.caption }))), []);
}

/* ── Homepage ───────────────────────────────────────────────────────── */
const STYLES = [   // the five construction clips, in the order of the homepage's rigid-box rows
  ['/lid-base-box.html', 'Lid and base', 'How a lid and base box is made'],
  ['/rigid-box.html', 'Magnetic book-style', 'How a magnetic box is made'],
  ['/shoulder-box.html', 'Shoulder-neck', 'How a shoulder-neck box is made'],
  ['/drawer-box.html', 'Drawer', 'How a drawer box is made'],
  ['/collapsible-box.html', 'Collapsible', 'How a collapsible box is made'],
];
function renderHome(preview) {
  const ctx = context(), page = resolver(ctx)(store.page('/', preview));
  const sec = {}; page.sections.forEach(s => { sec[s.key] = s; });
  const capImages = ctx.caps.map(c => c.image_url || ''), firstImage = capImages.find(Boolean);
  const parts = {
    h1: esc(page.h1), tag: page.lead ? '<p class="v2-hero-sub">' + esc(page.lead) + '</p>' : '',
    'about-h2': esc(sec.about.h2), 'about-lead': rich(sec.about.paras[0] || ''), 'about-p': rich(sec.about.paras[1] || ''),
    'products-h2': esc(sec.products.h2), 'products-intro': rich(sec.products.intro), 'product-tiles': familyTiles(),
    'studio-h2': esc(sec.studio.h2), 'studio-p': rich(sec.studio.intro),
    'caps-h2': esc(sec.caps.h2), 'caps-intro': rich(sec.caps.intro),
    capabilities: sec.caps.rows.map(([title, body], i) =>
      '<li' + (i === 0 ? ' class="is-active"' : '') + ' data-image="' + esc(capImages[i] || '') + '">' +
        '<button type="button"><b>' + num(i) + '</b> ' + esc(title) + '</button>' +
        '<div class="v2-tab-body"><div><p>' + rich(body) + '</p></div></div></li>').join('\n          '),
    'capability-image': firstImage
      ? '<div class="v2-media"><img id="v2CapImage" src="' + esc(firstImage) + '" alt="Inside the Kraftman Packaging plant" loading="lazy" onerror="this.parentNode.remove()" /></div>' : '',
    'line-h2': esc(sec.line.h2), 'line-intro': rich(sec.line.intro),
    'line-steps': sec.line.steps.map(([t, p]) => '<li><h3>' + esc(t) + '</h3><p>' + rich(p) + '</p></li>').join('\n        '),
    'styles-h2': esc(sec.styles.h2), 'styles-intro': rich(sec.styles.intro),
    styles: sec.styles.rows.map(([title, body], i) =>
      '<li' + (i === 0 ? ' class="is-active"' : '') + ' data-clip="' + STYLES[i][0] + '" data-name="' + STYLES[i][1] + '">' +
        '<button type="button"><b>' + num(i) + '</b> ' + esc(title) + '</button>' +
        '<div class="v2-tab-body"><div><p>' + rich(body) + '</p>' + more(STYLES[i][0], STYLES[i][2]) + '</div></div></li>').join('\n          '),
    'certs-h2': esc(sec.certs.h2),
    'hide-clients': ctx.clients.length ? '' : 'hidden',
    clients: ctx.clients.map(c => '<img src="' + esc(c.logo_url) + '" alt="' + esc(c.name) + '" loading="lazy" onerror="this.remove()" />').join(''),
    'hide-certifications': ctx.certs.length ? '' : 'hidden',
    certifications: certList(ctx),
    'hide-trust': ctx.clients.length || ctx.certs.length ? '' : 'hidden',
    faqs: faqList(page.faqs),
    'contact-h2': esc(sec.contact.h2), 'contact-p': rich(sec.contact.intro),
    'contact-list': contactList(ctx), 'enquiry-form': enquiryForm(),
  };
  return layout(ctx, {
    path: '/', home: true, noindex: !!preview, faqs: page.faqs, title: page.title, description: page.description,
    main: fs.readFileSync(HOME, 'utf8').replace(/\{\{ssr:([a-z0-9-]+)\}\}/g, (m, name) => (name in parts ? parts[name] : '')),
    scripts: ['/js/auto-line-loader.js?v=11'],
  });
}

/* ── Every other page ───────────────────────────────────────────────── */
function sectionBody(s, ctx, page) {
  let html = '';
  if (s.paras) html += '<div class="v2-prose">' + s.paras.map(p => '<p>' + rich(p) + '</p>').join('') + '</div>';
  if (s.rows || s.steps) {
    const tag = s.steps ? 'ol' : 'ul';
    html += '<' + tag + ' class="v2-rows' + (s.steps ? ' v2-numbered' : '') + '">' + (s.rows || s.steps).map(([title, text, href]) =>
      '<li><h3>' + esc(title) + '</h3><div><p>' + rich(text) + '</p>' + (href ? more(href, 'See how it is made') : '') + '</div></li>').join('') + '</' + tag + '>';
  }
  if (s.certs) html += '<ul class="v2-rows">' + ctx.certs.map(c => '<li><h3>' + esc(c.title) + '</h3><div><p>' + esc(c.body) + '</p></div></li>').join('') + '</ul>';
  if (s.families) html += familyTiles();
  if (s.catalogue) {
    html += '<div class="v2-tiles v2-gallery">' + galleryItems(page.parent === '/products' ? page.path.split('/').pop() : null).map(g =>
      '<figure class="v2-tile"><img src="' + esc(g.image) + '" alt="' + esc(g.caption || g.family) + '" loading="lazy" onerror="this.parentNode.remove()" />' +
      (page.parent ? '' : '<small>' + esc(g.family) + '</small>') + (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') + '</figure>').join('') + '</div>';
  }
  if (s.table) {
    html += '<div class="v2-table-wrap"><table class="v2-table"><thead><tr>' + s.table.head.map(h => '<th scope="col">' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
      s.table.rows.map(r => '<tr>' + r.map((c, i) => (i ? '<td>' + rich(c) + '</td>' : '<th scope="row">' + esc(c) + '</th>')).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  if (s.facts) html += '<dl class="v2-facts">' + s.facts.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('') + '</dl>';
  if (s.bullets) html += '<ul class="v2-bullets">' + s.bullets.map(b => '<li>' + rich(b) + '</li>').join('') + '</ul>';
  if (s.after) html += '<p class="v2-after">' + rich(s.after) + '</p>';
  if (s.link) html += '<p class="v2-more">' + more(s.link[0], s.link[1]) + '</p>';
  return html;
}

// The header photo: the page's own, or the one it inherits (its family's, the About picture, a capability's).
function headerPhoto(page, ctx) {
  if (page.photo) return page.photo;
  const from = page.photoFrom || '';
  if (from === 'family') { const f = store.families().find(x => x.href === page.path); return f && f.photo ? f.photo.url : ''; }
  if (from === 'about') return ctx.aboutPhoto;
  if (from.indexOf('cap:') === 0) return ctx.capabilityPhoto(+from.slice(4));
  return '';
}

function pageMain(page, ctx, crumbs) {
  const photo = headerPhoto(page, ctx);
  const trail = crumbs.map(([href, name], i) => (i === crumbs.length - 1 ? '<span aria-current="page">' + esc(name) + '</span>' : '<a href="' + href + '">' + esc(name) + '</a>')).join('<i>/</i>');
  const head = `    <section class="v2-pagehead${photo ? ' has-photo' : ''}">
      <nav class="v2-crumbs" aria-label="Breadcrumb">${trail}</nav>
      <div class="v2-pagehead-grid">
        <div>
          <p class="v2-kicker">${esc(page.kicker)}</p>
          <h1 class="v2-title">${esc(page.h1)}</h1>
          <p class="v2-lead">${rich(page.lead)}</p>
        </div>
        ${photo ? '<div class="v2-pagehead-photo"><img src="' + esc(photo) + '" alt="' + esc(page.h1 + ' at Kraftman Packaging') + '" onerror="this.closest(\'.v2-pagehead\').classList.remove(\'has-photo\');this.parentNode.remove()" /></div>' : ''}
      </div>
    </section>`;
  const contact = page.contact ? `
    <section class="v2-contact" id="enquiry">
      <div class="v2-contact-copy">
        <p class="v2-kicker">Request a quote</p>
        <h2 class="v2-title">Send us your enquiry.</h2>
        ${contactList(ctx)}
      </div>
      ${enquiryForm()}
    </section>` : '';
  // A gallery with no photographs yet is left out, heading and all.
  const sections = page.sections.filter(s => !s.catalogue || galleryItems(page.parent === '/products' ? page.path.split('/').pop() : null).length).map(s => `
    <section class="v2-section v2-block"${s.id ? ' id="' + s.id + '"' : ''}>
      <div class="v2-block-head"><h2 class="v2-title">${esc(s.h2)}</h2>${s.intro ? '<p class="v2-intro">' + rich(s.intro) + '</p>' : ''}</div>
      <div class="v2-block-body">${sectionBody(s, ctx, page)}</div>
    </section>`).join('');
  const faqs = page.faqs.length ? `
    <section class="v2-section v2-faq">
      <div><p class="v2-kicker">Questions</p><h2 class="v2-title">Questions we are asked.</h2></div>
      <div class="v2-faq-list">
        ${faqList(page.faqs)}
      </div>
    </section>` : '';
  const cta = page.cta ? `
    <section class="v2-band">
      <div><h2>${esc(page.cta.h2)}</h2><p>${esc(page.cta.p)}</p></div>
      <div class="v2-band-actions">${page.cta.buttons.map(([href, label], i) => '<a class="v2-btn' + (i ? ' ghost' : '') + '" href="' + href + '">' + esc(label) + ' <span>&nearr;</span></a>').join('')}</div>
    </section>` : '';
  return head + contact + sections + faqs + cta;
}

function renderPage(pagePath, preview) {
  if (pagePath === '/') return renderHome(preview);
  const stored = store.page(pagePath, preview);
  if (!stored) return null;
  const ctx = context(), page = resolver(ctx)(stored);
  const parent = page.parent && store.page(page.parent);
  const crumbs = [['/', 'Home']].concat(parent ? [[parent.path, parent.crumb]] : [], [[page.path, page.crumb]]);
  return layout(ctx, { path: page.path, noindex: !!preview, title: page.title, description: page.description, crumbs, faqs: page.faqs, main: pageMain(page, ctx, crumbs) });
}

function renderNotFound() {
  const ctx = context();
  return layout(ctx, {
    path: '/404', noindex: true, title: 'Page not found | Kraftman Packaging', description: 'That page does not exist.',
    main: `    <section class="v2-pagehead">
      <div class="v2-pagehead-grid"><div>
        <p class="v2-kicker">404</p>
        <h1 class="v2-title">That page is not here.</h1>
        <p class="v2-lead">It may have moved when the site was rebuilt. These will get you where you were going.</p>
        <p class="v2-more"><a class="v2-link" href="/">Home <span>&nearr;</span></a> &nbsp; <a class="v2-link" href="/products">What we make <span>&nearr;</span></a> &nbsp; <a class="v2-link" href="/contact">Contact <span>&nearr;</span></a></p>
      </div></div>
    </section>`,
  });
}

/* ── Every public page, for sitemap.xml and llms.txt ────────────────── */
const STATIC_PAGES = [
  { path: '/studio.html', title: 'Kraftman 3D Studio', about: 'Design packaging in 3D: enter a size, pick a PANTONE colour, upload artwork as a PDF or image, add foil, spot UV, embossing and a window, see the flat layout, then request a quote.', priority: '0.8' },
  { path: '/lid-base-box.html', title: 'How a lid and base rigid box is made', about: 'Step-by-step construction of a two-piece rigid box.', priority: '0.6' },
  { path: '/rigid-box.html', title: 'How a magnetic book-style rigid box is made', about: 'Step-by-step construction of a magnetic closure rigid box.', priority: '0.6' },
  { path: '/shoulder-box.html', title: 'How a shoulder-neck rigid box is made', about: 'Step-by-step construction of a shoulder-neck rigid box.', priority: '0.6' },
  { path: '/drawer-box.html', title: 'How a drawer rigid box is made', about: 'Step-by-step construction of a drawer (slide) rigid box.', priority: '0.6' },
  { path: '/collapsible-box.html', title: 'How a collapsible rigid box is made', about: 'Step-by-step construction of a collapsible rigid box that ships flat.', priority: '0.6' },
];
function siteMap() {
  const resolve = resolver(context());
  return store.defaults().map(d => resolve(store.page(d.path))).map(p => (p.home
    ? { path: '/', title: 'Kraftman Packaging', about: 'Company overview, products, capabilities, certifications and contact details.', priority: '1.0', page: p }
    : { path: p.path, title: p.h1, about: p.description, priority: p.parent ? '0.9' : '0.8', page: p })).concat(STATIC_PAGES);
}

module.exports = { renderHome, renderPage, renderNotFound, siteMap, context, SITE_URL };
