/**
 * What every page of the site shares: the facts read from the database, the
 * page frame (head, header, menu, quick actions, footer) and the structured
 * data that tells search engines and AI assistants who Kraftman Packaging is.
 *
 * Pages are rendered on the server. Crawlers and AI assistants mostly do not
 * run JavaScript, so anything they should be able to read and quote has to be
 * in the HTML they receive.
 */
const db = require('../database');

const SITE_URL = (process.env.SITE_URL || 'https://www.kraftmanpackaging.com').replace(/\/$/, '');
const LEGAL_NAME = 'Kraftman Packaging Private Limited';
const ASSETS = { css: '/css/v2.css?v=24', js: '/js/v2.js?v=8' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tel = n => 'tel:' + String(n).replace(/[^+\d]/g, '');
const abs = url => (/^https?:/.test(url) ? url : SITE_URL + url);
const capitalise = s => s.charAt(0).toUpperCase() + s.slice(1);

// Copy may carry links written as [label](/path); everything else is escaped.
const rich = s => esc(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
// The same copy as plain text, for structured data and llms.txt.
const plain = s => String(s).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '$1');

// "A", "A and B", "A, B and C"
function sentenceList(items) {
  if (items.length < 2) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

// How the certifications read inside a sentence. Titles come from the admin
// panel ("GMI Certified", "Sedex Member", "SMETA Audited"), so the sentence is
// built from them: "GMI certified, a Sedex member and SMETA audited".
function credentialPhrase(certs) {
  return sentenceList(certs.map(c => {
    const m = c.title.match(/^(.+?)\s+(Certified|Audited|Member|Compliant)$/i);
    if (!m) return c.title;
    const role = m[2].toLowerCase();
    return role === 'member' ? 'a ' + m[1] + ' member' : m[1] + ' ' + role;
  }));
}

/* ── The facts, from the database the admin panel edits ─────────────── */
function context() {
  const s = db.getSettings();
  const certs = db.getCertifications(true);
  const products = db.getProducts(true);
  const caps = db.getCapabilities(true);
  const photo = url => (url && !/placeholder/.test(url) ? url : '');
  return {
    logo: s.site_logo || '',
    phones: [s.phone1, s.phone2, s.phone3].filter(Boolean),
    email: s.email || '',
    address: s.address || 'Palwal, Haryana, India',
    caps, products, certs,
    // The brand tagline, written "A | B | C" in the settings and shown with bullets.
    tagline: String(s.tagline || '').split('|').map(part => part.trim()).filter(Boolean).join(' \u2022 '),
    clients: db.getClients(true).filter(c => c.logo_url),
    credentials: certs.length ? credentialPhrase(certs) : '',
    // A real photograph for a page, where the admin panel has one: a product in that category, or a capability.
    productPhoto: category => photo((products.find(p => p.category === category && photo(p.image_url)) || {}).image_url),
    capabilityPhoto: n => photo((caps[n] || {}).image_url),
    aboutPhoto: photo(s.about_visual_image),
  };
}

/* ── Navigation ─────────────────────────────────────────────────────── */
const MENU = [
  ['/studio.html', 'Kraftman 3D Studio'],
  ['/products', 'What we make'],
  ['/products/rigid-boxes', 'Rigid boxes'],
  ['/capabilities', 'Machines and capabilities'],
  ['/packaging-development', 'Packaging development'],
  ['/quality', 'Quality and certifications'],
  ['/industries', 'Industries'],
  ['/about', 'About Kraftman Packaging'],
  ['/contact', 'Contact and quotes'],
];
const FOOTER = [
  ['Products', [
    ['/products/printed-mono-cartons', 'Printed Mono Cartons'],
    ['/products/corrugated-boxes', 'Corrugated and litho-laminated boxes'],
    ['/products/retail-display-packaging', 'PDQ and retail displays'],
    ['/products/backer-cards', 'Backer, header and blister cards'],
    ['/products/hang-tags', 'Hangtags and bellybands'],
    ['/products/rigid-boxes', 'Rigid boxes'],
  ]],
  ['Company', [
    ['/about', 'About us'],
    ['/capabilities', 'Machines and capabilities'],
    ['/packaging-development', 'Packaging development'],
    ['/quality', 'Quality and certifications'],
    ['/industries', 'Industries'],
    ['/studio.html', 'Kraftman 3D Studio'],
    ['/contact', 'Contact'],
  ]],
  ['How rigid boxes are made', [
    ['/lid-base-box.html', 'Lid and base box'],
    ['/rigid-box.html', 'Magnetic box'],
    ['/shoulder-box.html', 'Shoulder-neck box'],
    ['/drawer-box.html', 'Drawer box'],
    ['/collapsible-box.html', 'Collapsible box'],
  ]],
];

/* ── Structured data ────────────────────────────────────────────────── */
const ORG_ID = SITE_URL + '/#organization';
function organization(ctx) {
  const postcode = (ctx.address.match(/\b\d{6}\b/) || [])[0];
  const org = {
    '@type': ['Organization', 'LocalBusiness'],
    '@id': ORG_ID,
    name: 'Kraftman Packaging',
    legalName: LEGAL_NAME,
    url: SITE_URL + '/',
    description: 'Paperboard packaging manufacturer in Palwal, Haryana, India: printed mono cartons, litho-laminated corrugated boxes, PDQ and retail displays, backer and header cards, hangtags and rigid boxes.',
    foundingDate: '2016',
    address: { '@type': 'PostalAddress', streetAddress: ctx.address, addressLocality: 'Palwal', addressRegion: 'Haryana', addressCountry: 'IN' },
    areaServed: ['India', 'Worldwide'],
    knowsAbout: [
      'Printed mono cartons', 'Folding cartons', 'Litho-laminated corrugated boxes', 'Corrugated packaging', 'PDQ display boxes',
      'Retail display packaging', 'Backer cards', 'Header cards', 'Blister cards', 'Hangtags', 'Rigid boxes',
      'Offset printing', 'Flute lamination', 'Die-cutting', 'Packaging structural design', 'Colour management',
    ],
  };
  if (postcode) org.address.postalCode = postcode;
  if (ctx.logo) org.logo = org.image = abs(ctx.logo);
  if (ctx.email) org.email = ctx.email;
  if (ctx.phones[0]) org.telephone = ctx.phones[0];
  if (ctx.phones.length) {
    org.contactPoint = ctx.phones.map((p, i) => ({ '@type': 'ContactPoint', telephone: p, contactType: i === 0 ? 'customer service' : 'sales' }));
  }
  if (ctx.certs.length) {
    org.hasCredential = ctx.certs.map(c => ({ '@type': 'EducationalOccupationalCredential', credentialCategory: 'certification', name: c.title, description: c.body }));
  }
  return org;
}

// page: { path, title, description, crumbs: [[path, name]…], faqs: [{q, a}] }
function structuredData(ctx, page) {
  const url = SITE_URL + page.path;
  const graph = [
    organization(ctx),
    { '@type': 'WebSite', '@id': SITE_URL + '/#website', url: SITE_URL + '/', name: 'Kraftman Packaging', publisher: { '@id': ORG_ID } },
    { '@type': 'WebPage', '@id': url + '#page', url, name: page.title, description: page.description, isPartOf: { '@id': SITE_URL + '/#website' }, about: { '@id': ORG_ID }, inLanguage: 'en' },
  ];
  if (page.crumbs && page.crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: page.crumbs.map(([path, name], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + path })),
    });
  }
  if (page.faqs && page.faqs.length) {
    graph.push({ '@type': 'FAQPage', mainEntity: page.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: plain(f.a) } })) });
  }
  // "<" is escaped so no value can close the script element early.
  return '<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c') + '</script>';
}

/* ── The page frame ─────────────────────────────────────────────────── */
// page: { path, title, description, home?, noindex?, crumbs?, faqs?, main, scripts? }
function layout(ctx, page) {
  const logo = ctx.logo ? '<img src="' + esc(ctx.logo) + '" alt="Kraftman Packaging" />' : '<span class="v2-logo-text">Kraftman Packaging</span>';
  const url = SITE_URL + page.path;
  const links = list => list.map(([href, label]) => '<a href="' + href + '">' + esc(label) + '</a>').join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}" />
  ${page.noindex ? '<meta name="robots" content="noindex" />' : '<link rel="canonical" href="' + esc(url) + '" />'}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Kraftman Packaging" />
  <meta property="og:locale" content="en_IN" />
  <meta property="og:url" content="${esc(url)}" />
  <meta property="og:title" content="${esc(page.title)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:image" content="${esc(ctx.logo ? abs(ctx.logo) : SITE_URL + '/images/og-image.svg')}" />
  <meta name="twitter:card" content="summary_large_image" />

  ${page.noindex ? '' : structuredData(ctx, page)}

  <link rel="icon" href="/images/favicon.svg" type="image/svg+xml" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Lexend+Exa:wght@300;400;500&family=Montserrat:wght@600&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${ASSETS.css}" />
</head>
<body id="top" class="${page.home ? 'is-home' : 'is-inner'}">

  <header class="v2-header" id="v2Header">
    <a class="v2-header-link" href="/studio.html">Kraftman 3D Studio <span>&nearr;</span></a>
    <a class="v2-logo" href="/" aria-label="Kraftman Packaging, home">${logo}</a>
    <button class="v2-burger" id="v2Burger" aria-label="Open menu" aria-expanded="false" aria-controls="v2Menu"><i></i><i></i></button>
  </header>

  <nav class="v2-menu" id="v2Menu" aria-hidden="true" aria-label="Main">
    <ol>
      ${MENU.map(([href, label]) => '<li><a href="' + href + '">' + esc(label) + '</a></li>').join('\n      ')}
    </ol>
    <div class="v2-menu-foot">
      <a href="https://erp.kraftmanpackaging.com" target="_blank" rel="noopener">Employee log in <span>&nearr;</span></a>
      ${ctx.email ? '<a href="mailto:' + esc(ctx.email) + '">' + esc(ctx.email) + '</a>' : ''}
    </div>
  </nav>

  <aside class="v2-rail" id="v2Rail" aria-label="Quick actions">
    <button class="v2-rail-toggle" id="v2RailToggle" aria-label="Hide quick actions" aria-expanded="true">&rsaquo;</button>
    <a href="/contact">Request a quote <span>&nearr;</span></a>
    <a href="/studio.html">Kraftman 3D Studio <span>&nearr;</span></a>
    <a href="/products">What we make <span>&nearr;</span></a>
    <a href="${esc(ctx.phones[0] ? tel(ctx.phones[0]) : '/contact')}">Call us <span>&nearr;</span></a>
  </aside>

  <div class="v2-progress" aria-hidden="true"><b id="v2Progress"></b></div>

  <main>
${page.main}
  </main>

  <footer class="v2-footer">
    <div class="v2-footer-cols">
      <div class="v2-footer-brand">
        <a class="v2-logo" href="/" aria-label="Kraftman Packaging, home">${logo}</a>
        ${ctx.tagline ? '<p class="v2-footer-tag">' + esc(ctx.tagline) + '</p>' : ''}
        <address>
          ${LEGAL_NAME}<br />${esc(ctx.address)}<br />
          ${ctx.phones.map(p => '<a href="' + esc(tel(p)) + '">' + esc(p) + '</a>').join(' &middot; ')}<br />
          ${ctx.email ? '<a href="mailto:' + esc(ctx.email) + '">' + esc(ctx.email) + '</a>' : ''}
        </address>
      </div>
      ${[['Products', require('./store').families().map(f => [f.href, f.name])]].concat(FOOTER.slice(1)).map(([heading, list]) => '<nav aria-label="' + esc(heading) + '"><h2>' + esc(heading) + '</h2>' + links(list) + '</nav>').join('\n      ')}
    </div>
    <p>&copy; <span id="v2Year">${new Date().getFullYear()}</span> ${LEGAL_NAME}, Palwal, Haryana, India.</p>
  </footer>

  <script src="${ASSETS.js}"></script>
  ${(page.scripts || []).map(src => '<script src="' + src + '"></script>').join('\n  ')}
</body>
</html>
`;
}

module.exports = { SITE_URL, LEGAL_NAME, MENU, esc, rich, plain, tel, abs, capitalise, sentenceList, credentialPhrase, context, layout };
