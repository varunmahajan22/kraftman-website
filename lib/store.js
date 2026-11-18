/**
 * The content manager's store: the marketing team's edits, laid over the
 * defaults in lib/content.js.
 *
 *   Pages     db.pages[path] = { draft, published, draft_at, published_at, by }
 *             A page with no row shows its default. Saving writes the draft;
 *             publishing copies it to published; resetting removes the row.
 *   Families  db.families[slug] = { name, blurb, photo, gallery: [...] }
 *             The product families and their photographs. Six are built in (lib/content.js);
 *             ranges added in the admin are stored here with `custom: true` and get their own page.
 *
 * What may be edited is decided by the default: the kind and number of
 * sections are fixed, and `clean()` rebuilds every save from the default's
 * shape, so nothing an editor sends can produce a page that fails to render.
 */
const db = require('../database');
const { pages, home, FAMILIES, productPage } = require('./content');

const LIMITS = { title: 70, description: 180 };
const LISTS = ['paras', 'bullets', 'rows', 'steps', 'facts'];

const defaults = () => [home()].concat(pages(), families().filter(f => f.custom).map(productPage));
const defaultFor = path => defaults().find(p => p.path === path);

const text = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, max || 3000);
const list = v => (Array.isArray(v) ? v : []);
const image = v => (v && typeof v.url === 'string' && /^\/uploads\/[\w.-]+$/.test(v.url)
  ? { url: v.url, original: /^\/uploads\/originals\/[\w.-]+$/.test(v.original || '') ? v.original : '', focus: Array.isArray(v.focus) ? [+v.focus[0] || 0, +v.focus[1] || 0] : null, slot: v.slot === 'product' ? 'product' : 'page' }
  : null);

// What an editor may change in a page, taken from what they sent but shaped by the default.
function clean(input, def) {
  const src = input || {}, errors = [];
  const out = { title: text(src.title, 200), description: text(src.description, 400), h1: text(src.h1, 200), lead: text(src.lead, 1200) };
  if (def.kicker !== undefined) out.kicker = text(src.kicker, 80);
  if (!def.home) out.photo = image(src.photo);
  if (out.title.length > LIMITS.title) errors.push('The Google title is ' + out.title.length + ' characters. Keep it to ' + LIMITS.title + '.');
  if (!out.title) errors.push('The Google title is empty.');
  if (out.description.replace(/\{[a-z-]+\}/g, '').length > LIMITS.description) errors.push('The Google description is too long. Keep it to ' + LIMITS.description + ' characters.');
  if (!out.h1) errors.push('The main heading is empty.');

  out.sections = def.sections.map((ds, i) => {
    const is = list(src.sections)[i] || {}, s = { h2: text(is.h2, 200) };
    const name = ds.h2 || 'Section ' + (i + 1);
    if (!s.h2) errors.push('The heading of "' + name + '" is empty.');
    if (ds.intro !== undefined || is.intro) s.intro = text(is.intro, 800);
    if (ds.after !== undefined) s.after = text(is.after, 800);
    if (ds.paras) s.paras = list(is.paras).map(p => text(p)).filter(Boolean);
    if (ds.bullets) s.bullets = list(is.bullets).map(p => text(p, 800)).filter(Boolean);
    ['rows', 'steps', 'facts'].forEach(kind => {
      if (!ds[kind]) return;
      s[kind] = list(is[kind]).map((r, k) => {
        const row = [text(list(r)[0], 200), text(list(r)[1], 1500)];
        const href = ds.fixed && (ds[kind][k] || [])[2];   // "See how it is made" links stay with their row
        return href ? row.concat(href) : row;
      }).filter(r => r[0] || r[1]);
    });
    if (ds.table) {
      const it = is.table || {};
      s.table = {
        head: ds.table.head.map((h, k) => text(list(it.head)[k], 80) || h),
        rows: list(it.rows).map(r => ds.table.head.map((h, k) => text(list(r)[k], 800))).filter(r => r.some(Boolean)),
      };
      if (!s.table.rows.length) errors.push('"' + name + '" needs at least one row.');
    }
    LISTS.forEach(kind => {
      if (!ds[kind]) return;
      if (!s[kind].length) errors.push('"' + name + '" needs at least one item.');
      if (ds.fixed && s[kind].length !== ds[kind].length) errors.push('"' + name + '" must keep exactly ' + ds[kind].length + ' items.');
    });
    return s;
  });

  out.faqs = list(src.faqs).map(f => {
    const q = { q: text(f && f.q, 300), a: text(f && f.a) };
    if (f && /^(certs|cert:[a-z]+)$/.test(f.needs || '')) q.needs = f.needs;
    return q;
  }).filter(f => f.q && f.a);
  if (def.cta) out.cta = { h2: text(src.cta && src.cta.h2, 200), p: text(src.cta && src.cta.p, 600) };
  return { page: out, errors };
}

// A page as it should be rendered: the default's fixed parts with the stored words over them.
function merge(def, stored) {
  if (!stored) return def;
  const page = Object.assign({}, def, { title: stored.title, description: stored.description, h1: stored.h1, lead: stored.lead });
  if (stored.kicker !== undefined) page.kicker = stored.kicker;
  if (stored.photo) page.photo = stored.photo.url;
  page.sections = def.sections.map((ds, i) => Object.assign({}, ds, (stored.sections || [])[i] || {}));
  page.faqs = stored.faqs || def.faqs;
  if (def.cta && stored.cta) page.cta = Object.assign({}, def.cta, stored.cta);
  return page;
}

const row = path => db.read().pages[path];
// preview: show the draft if there is one.
function page(path, preview) {
  const def = defaultFor(path);
  if (!def) return null;
  const r = row(path) || {};
  return merge(def, preview && r.draft ? r.draft : r.published);
}
// What the admin's editor works on: the current words in editable shape, and the default beside them.
function editing(path) {
  const def = defaultFor(path);
  if (!def) return null;
  const r = row(path) || {}, current = merge(def, r.draft || r.published);
  return {
    path, name: def.crumb, status: status(r),
    draft_at: r.draft_at || null, published_at: r.published_at || null, by: r.by || null,
    page: clean(Object.assign({}, current, { photo: (r.draft || r.published || {}).photo }), def).page,
    // The fixed side of each section, so the editor knows what it is drawing.
    shape: def.sections.map(s => ({
      kind: s.certs ? 'certs' : s.catalogue ? 'catalogue' : s.families ? 'families' : s.table ? 'table' : LISTS.find(k => s[k]) || 'text',
      fixed: !!s.fixed, note: s.note || '', intro: s.intro !== undefined, after: s.after !== undefined,
    })),
    home: !!def.home, hasCta: !!def.cta, hasKicker: def.kicker !== undefined, limits: LIMITS,
  };
}
const status = r => (r && r.draft ? 'draft' : r && r.published ? 'published' : 'default');
const listing = () => { const all = db.read().pages; return defaults().map(d => ({ path: d.path, name: d.crumb, status: status(all[d.path]), draft_at: (all[d.path] || {}).draft_at || null })); };

function saveDraft(path, input, by) {
  const def = defaultFor(path);
  if (!def) return { errors: ['No such page.'] };
  const { page: cleaned, errors } = clean(input, def);
  if (errors.length) return { errors };
  db.write(data => { data.pages[path] = Object.assign({}, data.pages[path], { draft: cleaned, draft_at: new Date().toISOString(), by }); });
  return { errors: [] };
}
function publish(path, by) {
  return db.write(data => {
    const r = data.pages[path];
    if (!r || !r.draft) return false;
    data.pages[path] = { published: r.draft, published_at: new Date().toISOString(), by };
    return true;
  });
}
const discard = path => db.write(data => { const r = data.pages[path]; if (!r) return; if (r.published) { delete r.draft; delete r.draft_at; } else delete data.pages[path]; });
const reset = path => db.write(data => { delete data.pages[path]; });

/* ── Product families ───────────────────────────────────────────────── */
// The first time the content manager runs, the old product list becomes gallery photos under the six families.
function migrate() {
  db.write(data => {
    if (data.families && data.families._migrated) return;
    data.families = data.families || {};
    FAMILIES.forEach(f => {
      const fam = data.families[f.slug] = data.families[f.slug] || { photo: null, gallery: [] };
      (data.products || []).filter(p => f.was.indexOf(p.category) >= 0).forEach(p => {
        const real = p.image_url && !/placeholder/.test(p.image_url);
        fam.gallery.push({ id: db.nextId(data, 'gallery_items'), image: real ? { url: p.image_url, original: '', focus: null, slot: 'product' } : null,
          caption: p.name + (p.description ? '. ' + p.description : ''), sort: fam.gallery.length + 1, active: p.is_active ? 1 : 0 });
        if (real && !fam.photo) fam.photo = { url: p.image_url, original: '', focus: null, slot: 'product' };
      });
    });
    data.families._migrated = true;
  });
}
function families() {
  const stored = db.read().families || {};
  // The built-in families first, then the ranges added in the admin, in the order they were added.
  const added = Object.keys(stored).filter(slug => stored[slug] && stored[slug].custom).map(slug => ({ slug, name: slug, blurb: '' }));
  return FAMILIES.concat(added).map(f => {
    const s = stored[f.slug] || {};
    return { slug: f.slug, href: '/products/' + f.slug, name: s.name || f.name, blurb: s.blurb || f.blurb, photo: s.photo || null, custom: !!s.custom,
      gallery: (s.gallery || []).slice().sort((a, b) => a.sort - b.sort || a.id - b.id) };
  });
}
// Change one family inside a single load-and-save. `change(family, data)` may return a value.
function family(slug, change) {
  if (!families().some(f => f.slug === slug)) return null;
  return db.write(data => {
    data.families = data.families || {};
    const fam = data.families[slug] = data.families[slug] || { photo: null, gallery: [] };
    fam.gallery = fam.gallery || [];
    return change(fam, data);
  });
}

// Add a product range. Its address is made from its name; returns the new slug, or an error message.
function addFamily(name, blurb) {
  const title = text(name, 80), slug = title.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (title.length < 3 || !slug) return { error: 'Give the product range a name.' };
  if (families().some(f => f.slug === slug)) return { error: 'There is already a product range with that name.' };
  db.write(data => { data.families = data.families || {}; data.families[slug] = { custom: true, name: title, blurb: text(blurb, 240), photo: null, gallery: [] }; });
  return { slug };
}
// Remove a range that was added in the admin, with its page edits. The built-in six cannot be removed.
function removeFamily(slug) {
  return db.write(data => {
    if (!data.families || !data.families[slug] || !data.families[slug].custom) return false;
    delete data.families[slug];
    delete data.pages['/products/' + slug];
    return true;
  });
}

module.exports = { addFamily, removeFamily, defaults, page, editing, listing, saveDraft, publish, discard, reset, migrate, families, family, image, text };
