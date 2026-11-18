/**
 * The content manager's API, mounted at /admin/api/cms.
 *
 * Everything here needs a login. Two roles: an owner can do everything; an
 * editor (the marketing team) can change pages, product photos, clients and
 * certifications, but not users, passwords of others or contact details.
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const store = require('../lib/store');
const images = require('../lib/images');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, images.UPLOADS),
    // A product photo is named after its range ("rigid-boxes-…"), which search engines read; anything else by time.
    filename: (req, file, cb) => cb(null, (/^[a-z0-9-]+$/.test(req.params.slug || '') ? 'kraftman-' + req.params.slug + '-' : '') + Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname).toLowerCase()),
  }),
  fileFilter: (req, file, cb) => (/\.(jpe?g|png|gif|webp|avif|tiff?|bmp|svg)$/i.test(file.originalname) && /image/.test(file.mimetype) ? cb(null, true) : cb(new Error('Only picture files can be uploaded.'))),
  limits: { fileSize: 25 * 1024 * 1024 },
});

// Who is asking. The role is read from the database on every request, so removing a login takes effect at once.
function user(req, res, next) {
  const admin = db.findAdminById(req.admin.id);
  if (!admin) return res.status(401).json({ error: 'This login no longer exists.' });
  req.user = { id: admin.id, username: admin.username, role: admin.role || 'owner' };
  next();
}
const ownerOnly = (req, res, next) => (req.user.role === 'owner' ? next() : res.status(403).json({ error: 'Only an owner can do this.' }));
const fail = (res, err) => res.status(400).json({ error: (err && err.message) || 'That did not work.' });
const wrap = handler => (req, res) => Promise.resolve(handler(req, res)).catch(err => fail(res, err));

router.use(requireAuth, user);
router.get('/me', (req, res) => res.json(req.user));

/* ── Pages ──────────────────────────────────────────────────────────── */
router.get('/pages', (req, res) => res.json(store.listing()));
router.get('/page', (req, res) => {
  const page = store.editing(String(req.query.path || ''));
  return page ? res.json(page) : res.status(404).json({ error: 'No such page.' });
});
router.put('/page', (req, res) => {
  const { errors } = store.saveDraft(String(req.body.path || ''), req.body.page, req.user.username);
  return errors.length ? res.status(400).json({ error: errors[0], errors }) : res.json({ success: true });
});
router.post('/page/publish', (req, res) => (store.publish(String(req.body.path || ''), req.user.username) ? res.json({ success: true }) : res.status(400).json({ error: 'There is no draft to publish.' })));
router.post('/page/discard', (req, res) => { store.discard(String(req.body.path || '')); res.json({ success: true }); });
router.post('/page/reset', (req, res) => { store.reset(String(req.body.path || '')); res.json({ success: true }); });
// A link that shows the draft on the real page for an hour.
router.post('/page/preview', (req, res) => {
  const p = String(req.body.path || '');
  if (!store.page(p)) return res.status(404).json({ error: 'No such page.' });
  res.json({ url: p + '?preview=' + jwt.sign({ preview: true }, JWT_SECRET, { expiresIn: '1h' }) });
});
// A photograph for a page's header. The editor puts the returned record in the page and saves the draft.
router.post('/page/photo', upload.single('image'), wrap(async (req, res) => {
  if (!req.file) throw new Error('Choose a picture to upload.');
  res.json(await images.accept(req.file, 'page'));
}));

/* ── Product families and their photographs ─────────────────────────── */
router.get('/families', (req, res) => res.json(store.families()));
router.post('/families', (req, res) => {
  const made = store.addFamily(req.body.name, req.body.blurb);
  return made.error ? res.status(400).json({ error: made.error }) : res.json(made);
});
router.delete('/families/:slug', (req, res) => (store.removeFamily(req.params.slug) ? res.json({ success: true }) : res.status(400).json({ error: 'Only a product range you added can be removed.' })));
router.put('/families/:slug', (req, res) => {
  const done = store.family(req.params.slug, fam => { fam.name = store.text(req.body.name, 80); fam.blurb = store.text(req.body.blurb, 240); return true; });
  return done ? res.json({ success: true }) : res.status(404).json({ error: 'No such product family.' });
});
router.post('/families/:slug/photo', upload.single('image'), wrap(async (req, res) => {
  if (!req.file) throw new Error('Choose a picture to upload.');
  const record = await images.accept(req.file, 'product');
  if (store.family(req.params.slug, fam => { fam.photo = record; return true; }) === null) { images.remove(record); throw new Error('No such product family.'); }
  res.json(record);
}));
router.delete('/families/:slug/photo', (req, res) => { store.family(req.params.slug, fam => { fam.photo = null; }); res.json({ success: true }); });
router.post('/families/:slug/gallery', upload.array('images', 30), wrap(async (req, res) => {
  if (!req.files || !req.files.length) throw new Error('Choose one or more pictures to upload.');
  const records = [];
  for (const file of req.files) records.push(await images.accept(file, 'product'));
  const added = store.family(req.params.slug, (fam, data) => records.map(record => {
    const item = { id: db.nextId(data, 'gallery_items'), image: record, caption: store.text(req.body.caption, 240), sort: fam.gallery.length + 1, active: 1 };
    fam.gallery.push(item);
    return item;
  }));
  if (added === null) { records.forEach(images.remove); throw new Error('No such product family.'); }
  res.json(added);
}));
router.put('/families/:slug/gallery/:id', (req, res) => {
  const ok = store.family(req.params.slug, fam => {
    const item = fam.gallery.find(g => g.id === +req.params.id);
    if (!item) return false;
    if (req.body.caption !== undefined) item.caption = store.text(req.body.caption, 240);
    if (req.body.active !== undefined) item.active = req.body.active ? 1 : 0;
    return true;
  });
  return ok ? res.json({ success: true }) : res.status(404).json({ error: 'That photo is no longer there.' });
});
router.delete('/families/:slug/gallery/:id', (req, res) => {
  store.family(req.params.slug, fam => { fam.gallery = fam.gallery.filter(g => g.id !== +req.params.id); });
  res.json({ success: true });          // the files stay in the image library until deleted there
});
router.post('/families/:slug/gallery/order', (req, res) => {
  const ids = (req.body.ids || []).map(Number);
  store.family(req.params.slug, fam => { fam.gallery.forEach(g => { const at = ids.indexOf(g.id); g.sort = at < 0 ? 999 : at + 1; }); });
  res.json({ success: true });
});

// Crop a picture again round a new focus point. `where` says which picture it is.
router.post('/recut', wrap(async (req, res) => {
  const { where, focus } = req.body;
  if (!where || !Array.isArray(focus)) throw new Error('Nothing to crop.');
  if (where.kind === 'page') return res.json(await images.recut(store.image(where.record), focus));
  const current = store.families().find(f => f.slug === where.slug);
  const record = current && (where.kind === 'family' ? current.photo : (current.gallery.find(g => g.id === +where.id) || {}).image);
  const fresh = await images.recut(record, focus);
  store.family(where.slug, fam => {
    if (where.kind === 'family') fam.photo = fresh;
    else { const item = fam.gallery.find(g => g.id === +where.id); if (item) item.image = fresh; }
  });
  res.json(fresh);
}));

/* ── Order of clients and certifications ────────────────────────────── */
router.post('/order/:table', (req, res) => {
  const table = req.params.table, ids = (req.body.ids || []).map(Number);
  if (table !== 'clients' && table !== 'certifications') return res.status(404).json({ error: 'Nothing to reorder.' });
  db.write(data => { data[table].forEach(item => { const at = ids.indexOf(item.id); if (at >= 0) item.sort_order = at + 1; }); });
  res.json({ success: true });
});

/* ── Image library ──────────────────────────────────────────────────── */
// Where a file is used, by looking for its name in everything the site shows.
function usage() {
  const data = db.read();
  const places = { 'Product photos': data.families, Clients: data.clients, Certifications: data.certifications, Pages: data.pages, 'Site settings': data.site_settings, 'Old homepage': [data.products, data.gallery, data.capabilities] };
  const text = Object.keys(places).map(k => [k, JSON.stringify(places[k] || '')]);
  return name => text.filter(([, json]) => json.indexOf(name) >= 0).map(([k]) => k);
}
router.get('/library', (req, res) => {
  const used = usage();
  const files = fs.readdirSync(images.UPLOADS, { withFileTypes: true }).filter(f => f.isFile() && /\.(jpe?g|png|gif|webp|svg|avif)$/i.test(f.name)).map(f => {
    const stat = fs.statSync(path.join(images.UPLOADS, f.name));
    return { name: f.name, url: '/uploads/' + f.name, size: stat.size, at: stat.mtime, used: used(f.name) };
  }).sort((a, b) => new Date(b.at) - new Date(a.at));
  res.json(files);
});
router.delete('/library/:name', (req, res) => {
  const name = path.basename(req.params.name);
  if (usage()(name).length) return res.status(400).json({ error: 'This picture is in use. Remove it from where it is shown first.' });
  images.remove({ url: '/uploads/' + name });
  // Its original, if nothing else was cut from it.
  const stem = name.replace(/-[a-z0-9]+\.jpg$/, '');
  if (!fs.readdirSync(images.UPLOADS).some(f => f.indexOf(stem) === 0)) {
    fs.readdirSync(images.ORIGINALS).filter(f => f.indexOf(stem + '.') === 0).forEach(f => fs.unlinkSync(path.join(images.ORIGINALS, f)));
  }
  res.json({ success: true });
});

/* ── Enquiries as a spreadsheet ─────────────────────────────────────── */
router.get('/enquiries.csv', (req, res) => {
  const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const head = ['Date', 'Status', 'Name', 'Email', 'Phone', 'Company', 'Interested in', 'Message'];
  const rows = db.getEnquiries().map(e => [e.created_at, e.status || 'new', e.name, e.email, e.phone, e.company, e.product_interest, e.message].map(cell).join(','));
  res.type('text/csv').send('﻿' + head.map(cell).join(',') + '\r\n' + rows.join('\r\n'));
});

/* ── Users (owner only) ─────────────────────────────────────────────── */
const publicUser = a => ({ id: a.id, username: a.username, role: a.role || 'owner', created_at: a.created_at });
router.get('/users', ownerOnly, (req, res) => res.json(db.read().admins.map(publicUser)));
router.post('/users', ownerOnly, (req, res) => {
  const username = store.text(req.body.username, 40).toLowerCase(), password = String(req.body.password || '');
  if (!/^[a-z0-9._-]{3,40}$/.test(username)) return res.status(400).json({ error: 'A username is 3 to 40 letters, numbers, dots or dashes.' });
  if (password.length < 10) return res.status(400).json({ error: 'A password needs at least 10 characters.' });
  const created = db.write(data => {
    if (data.admins.some(a => a.username.toLowerCase() === username)) return null;
    const admin = { id: db.nextId(data, 'admins'), username, password_hash: bcrypt.hashSync(password, 12), role: req.body.role === 'owner' ? 'owner' : 'editor', created_at: new Date().toISOString() };
    data.admins.push(admin);
    return admin;
  });
  return created ? res.json(publicUser(created)) : res.status(400).json({ error: 'That username is taken.' });
});
router.post('/users/:id/password', ownerOnly, (req, res) => {
  const password = String(req.body.password || '');
  if (password.length < 10) return res.status(400).json({ error: 'A password needs at least 10 characters.' });
  const ok = db.write(data => { const a = data.admins.find(x => x.id === +req.params.id); if (a) a.password_hash = bcrypt.hashSync(password, 12); return !!a; });
  return ok ? res.json({ success: true }) : res.status(404).json({ error: 'No such user.' });
});
router.delete('/users/:id', ownerOnly, (req, res) => {
  if (+req.params.id === req.user.id) return res.status(400).json({ error: 'You cannot remove your own login.' });
  const ok = db.write(data => {
    const target = data.admins.find(a => a.id === +req.params.id);
    if (!target) return false;
    if ((target.role || 'owner') === 'owner' && data.admins.filter(a => (a.role || 'owner') === 'owner').length < 2) return false;
    data.admins = data.admins.filter(a => a.id !== target.id);
    return true;
  });
  return ok ? res.json({ success: true }) : res.status(400).json({ error: 'That login cannot be removed.' });
});

router.use((err, req, res, next) => fail(res, err));    // upload errors, as a message the screen can show

module.exports = { router, user, ownerOnly };
