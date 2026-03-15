const express  = require('express');
const router   = express.Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const db       = require('../database');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');
const { imageResizeMiddleware }   = require('../middleware/imageResize');

// ─── MULTER ────────────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '../public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random()*1e6)}${ext}`);
  }
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const ok = /\.(jpeg|jpg|png|gif|webp|svg|avif|tiff?|bmp)$/.test(ext) &&
             /image/.test(file.mimetype);
  ok ? cb(null, true) : cb(new Error('Only image files allowed'));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB||'10') * 1024 * 1024 } });

// ─── AUTH ───────────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const admin = db.findAdmin(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username: admin.username });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password || new_password.length < 8)
    return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const admin = db.findAdminById(req.admin.id);
  if (!bcrypt.compareSync(current_password, admin.password_hash))
    return res.status(401).json({ error: 'Current password incorrect' });
  db.updateAdminPassword(req.admin.id, bcrypt.hashSync(new_password, 12));
  res.json({ success: true });
});

// ─── UPLOAD ─────────────────────────────────────────────────────────────────────
router.post('/upload', requireAuth, upload.single('image'), imageResizeMiddleware('general'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  res.json({ success: true, url: `/uploads/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
});

router.post('/upload/multiple', requireAuth, upload.array('images', 20), imageResizeMiddleware('gallery'), (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'No images uploaded' });
  res.json({ success: true, files: req.files.map(f => ({ url: `/uploads/${f.filename}`, filename: f.filename, size: f.size })) });
});

router.delete('/upload/:filename', requireAuth, (req, res) => {
  const filePath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); res.json({ success: true }); }
  else res.status(404).json({ error: 'File not found' });
});

// ─── PRODUCTS ────────────────────────────────────────────────────────────────────
router.get('/products', requireAuth, (req, res) => {
  try { res.json(db.getProducts(false)); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/products', requireAuth, upload.single('image'), imageResizeMiddleware('product'), (req, res) => {
  const { category, name, description, sort_order } = req.body;
  if (!category || !name) return res.status(400).json({ error: 'Category and name required' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '/images/placeholder-product.svg');
  const item = db.createProduct({ category, name, description: description||'', image_url, sort_order: parseInt(sort_order)||0 });
  res.json({ success: true, id: item.id });
});

router.put('/products/:id', requireAuth, upload.single('image'), imageResizeMiddleware('product'), (req, res) => {
  const { id } = req.params;
  const { category, name, description, sort_order, is_active } = req.body;
  const existing = db.getProducts(false).find(p => p.id === parseInt(id));
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || existing.image_url);
  const gallery_images = req.body.gallery_images !== undefined ? req.body.gallery_images : existing.gallery_images;
  db.updateProduct(id, { category: category||existing.category, name: name||existing.name, description: description??existing.description, image_url, sort_order: sort_order!==undefined?parseInt(sort_order):existing.sort_order, is_active: is_active!==undefined?parseInt(is_active):existing.is_active, gallery_images });
  res.json({ success: true });
});

router.delete('/products/:id', requireAuth, (req, res) => {
  const deleted = db.deleteProduct(req.params.id);
  deleted ? res.json({ success: true }) : res.status(404).json({ error: 'Product not found' });
});

// POST /admin/api/products/:id/gallery — upload one gallery image
router.post('/products/:id/gallery', requireAuth, upload.single('image'), imageResizeMiddleware('gallery'), (req, res) => {
  const product = db.getProducts(false).find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (!req.file) return res.status(400).json({ error: 'Image required' });
  const url = `/uploads/${req.file.filename}`;
  let gallery = [];
  try { gallery = JSON.parse(product.gallery_images || '[]'); } catch {}
  gallery.push(url);
  db.updateProduct(req.params.id, { gallery_images: JSON.stringify(gallery) });
  res.json({ success: true, url, gallery });
});

// DELETE /admin/api/products/:id/gallery — remove one image URL from gallery
router.delete('/products/:id/gallery', requireAuth, (req, res) => {
  const product = db.getProducts(false).find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const urlToRemove = req.body && req.body.url ? req.body.url : req.query.url;
  let gallery = [];
  try { gallery = JSON.parse(product.gallery_images || '[]'); } catch {}
  gallery = gallery.filter(u => u !== urlToRemove);
  db.updateProduct(req.params.id, { gallery_images: JSON.stringify(gallery) });
  res.json({ success: true, gallery });
});

// ─── GALLERY ─────────────────────────────────────────────────────────────────────
router.get('/gallery', requireAuth, (req, res) => {
  try { res.json(db.getGallery(false)); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/gallery', requireAuth, upload.single('image'), imageResizeMiddleware('gallery'), (req, res) => {
  if (!req.file && !req.body.image_url) return res.status(400).json({ error: 'Image required' });
  const { title, category, alt_text, sort_order } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : req.body.image_url;
  const item = db.createGalleryItem({ title: title||'', category: category||'General', image_url, alt_text: alt_text||title||'', sort_order: parseInt(sort_order)||0 });
  res.json({ success: true, id: item.id });
});

router.put('/gallery/:id', requireAuth, upload.single('image'), imageResizeMiddleware('gallery'), (req, res) => {
  const { id } = req.params;
  const existing = db.getGallery(false).find(g => g.id === parseInt(id));
  if (!existing) return res.status(404).json({ error: 'Gallery item not found' });
  const { title, category, alt_text, sort_order, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || existing.image_url);
  db.updateGalleryItem(id, { title: title??existing.title, category: category??existing.category, image_url, alt_text: alt_text??existing.alt_text, sort_order: sort_order!==undefined?parseInt(sort_order):existing.sort_order, is_active: is_active!==undefined?parseInt(is_active):existing.is_active });
  res.json({ success: true });
});

router.delete('/gallery/:id', requireAuth, (req, res) => {
  const item = db.deleteGalleryItem(req.params.id);
  if (item?.image_url?.startsWith('/uploads/')) {
    const fp = path.join(__dirname, '../public', item.image_url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ success: true });
});

// ─── ENQUIRIES ───────────────────────────────────────────────────────────────────
router.get('/enquiries', requireAuth, (req, res) => {
  try { res.json(db.getEnquiries()); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/enquiries/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  if (!['new','read','replied','closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  db.updateEnquiryStatus(req.params.id, status);
  res.json({ success: true });
});

router.delete('/enquiries/:id', requireAuth, (req, res) => {
  db.deleteEnquiry(req.params.id);
  res.json({ success: true });
});

// ─── CLIENTS ─────────────────────────────────────────────────────────────────────
router.get('/clients', requireAuth, (req, res) => {
  try { res.json(db.getClients(false)); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/clients', requireAuth, upload.single('logo'), imageResizeMiddleware('logo'), (req, res) => {
  const { name, website, industry, sort_order, is_active } = req.body;
  if (!name) return res.status(400).json({ error: 'Client name required' });
  const logo_url = req.file ? `/uploads/${req.file.filename}` : (req.body.logo_url || '');
  const item = db.createClient({ name, logo_url, website: website||'', industry: industry||'', sort_order: parseInt(sort_order)||0, is_active: is_active !== undefined ? parseInt(is_active) : 1 });
  res.json({ success: true, id: item.id, item });
});

router.put('/clients/:id', requireAuth, upload.single('logo'), imageResizeMiddleware('logo'), (req, res) => {
  const { id } = req.params;
  const existing = db.getClients(false).find(c => c.id === parseInt(id));
  if (!existing) return res.status(404).json({ error: 'Client not found' });
  const { name, website, industry, sort_order, is_active } = req.body;
  const logo_url = req.file ? `/uploads/${req.file.filename}` : (req.body.logo_url || existing.logo_url);
  db.updateClient(id, { name: name||existing.name, logo_url, website: website??existing.website, industry: industry??existing.industry, sort_order: sort_order!==undefined?parseInt(sort_order):existing.sort_order, is_active: is_active!==undefined?parseInt(is_active):existing.is_active });
  res.json({ success: true });
});

router.delete('/clients/:id', requireAuth, (req, res) => {
  const item = db.deleteClient(req.params.id);
  if (item?.logo_url?.startsWith('/uploads/')) {
    const fp = path.join(__dirname, '../public', item.logo_url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ success: true });
});

// ─── CERTIFICATIONS ───────────────────────────────────────────────────────────────
router.get('/certifications', requireAuth, (req, res) => {
  try { res.json(db.getCertifications(false)); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/certifications', requireAuth, upload.single('image'), imageResizeMiddleware('cert'), (req, res) => {
  const { title, body, badge_icon, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '');
  const item = db.createCertification({ title, body: body||'', image_url, badge_icon: badge_icon||'fa-certificate', sort_order: parseInt(sort_order)||0 });
  res.json({ success: true, id: item.id, item });
});

router.put('/certifications/:id', requireAuth, upload.single('image'), imageResizeMiddleware('cert'), (req, res) => {
  const { id } = req.params;
  const existing = db.getCertifications(false).find(c => c.id === parseInt(id));
  if (!existing) return res.status(404).json({ error: 'Certification not found' });
  const { title, body, badge_icon, sort_order, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || existing.image_url);
  db.updateCertification(id, { title: title||existing.title, body: body??existing.body, image_url, badge_icon: badge_icon||existing.badge_icon, sort_order: sort_order!==undefined?parseInt(sort_order):existing.sort_order, is_active: is_active!==undefined?parseInt(is_active):existing.is_active });
  res.json({ success: true });
});

router.delete('/certifications/:id', requireAuth, (req, res) => {
  const item = db.deleteCertification(req.params.id);
  if (item?.image_url?.startsWith('/uploads/')) {
    const fp = path.join(__dirname, '../public', item.image_url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ success: true });
});

// ─── CAPABILITIES ────────────────────────────────────────────────────────────────
router.get('/capabilities', requireAuth, (req, res) => {
  try { res.json(db.getCapabilities(false)); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/capabilities', requireAuth, upload.single('image'), imageResizeMiddleware('general'), (req, res) => {
  const { title, description, icon, sort_order } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || '');
  const item = db.createCapability({ title, description: description||'', icon: icon||'fa-cog', image_url, sort_order: parseInt(sort_order)||0 });
  res.json({ success: true, id: item.id, item });
});

router.put('/capabilities/:id', requireAuth, upload.single('image'), imageResizeMiddleware('general'), (req, res) => {
  const { id } = req.params;
  const existing = db.getCapabilities(false).find(c => c.id === parseInt(id));
  if (!existing) return res.status(404).json({ error: 'Capability not found' });
  const { title, description, icon, sort_order, is_active } = req.body;
  const image_url = req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || existing.image_url);
  db.updateCapability(id, { title: title||existing.title, description: description??existing.description, icon: icon||existing.icon, image_url, sort_order: sort_order!==undefined?parseInt(sort_order):existing.sort_order, is_active: is_active!==undefined?parseInt(is_active):existing.is_active });
  res.json({ success: true });
});

router.delete('/capabilities/:id', requireAuth, (req, res) => {
  const item = db.deleteCapability(req.params.id);
  if (item?.image_url?.startsWith('/uploads/')) {
    const fp = path.join(__dirname, '../public', item.image_url);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  res.json({ success: true });
});

// ─── SETTINGS ────────────────────────────────────────────────────────────────────
router.get('/settings', requireAuth, (req, res) => {
  try { res.json(db.getSettings()); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/settings', requireAuth, (req, res) => {
  try { db.updateSettings(req.body); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed to save settings' }); }
});

// ─── STATS ───────────────────────────────────────────────────────────────────────
router.get('/stats', requireAuth, (req, res) => {
  try { res.json(db.getStats()); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

module.exports = router;
