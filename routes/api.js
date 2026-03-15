const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET /api/products
router.get('/products', (req, res) => {
  try {
    const { category } = req.query;
    const products = category ? db.getProductsByCategory(category) : db.getProducts(true);
    res.json(products);
  } catch { res.status(500).json({ error: 'Failed to load products' }); }
});

// GET /api/products/categories
router.get('/products/categories', (req, res) => {
  try { res.json(db.getProductCategories()); }
  catch { res.status(500).json({ error: 'Failed to load categories' }); }
});

// GET /api/gallery
router.get('/gallery', (req, res) => {
  try {
    const { category } = req.query;
    res.json(db.getGallery(true, category || null));
  } catch { res.status(500).json({ error: 'Failed to load gallery' }); }
});

// GET /api/settings
router.get('/settings', (req, res) => {
  try { res.json(db.getSettings()); }
  catch { res.status(500).json({ error: 'Failed to load settings' }); }
});

// GET /api/testimonials
router.get('/testimonials', (req, res) => {
  try { res.json(db.getTestimonials()); }
  catch { res.status(500).json({ error: 'Failed to load testimonials' }); }
});

// GET /api/clients
router.get('/clients', (req, res) => {
  try { res.json(db.getClients(true)); }
  catch { res.status(500).json({ error: 'Failed to load clients' }); }
});

// GET /api/certifications
router.get('/certifications', (req, res) => {
  try { res.json(db.getCertifications(true)); }
  catch { res.status(500).json({ error: 'Failed to load certifications' }); }
});

// GET /api/capabilities
router.get('/capabilities', (req, res) => {
  try { res.json(db.getCapabilities(true)); }
  catch { res.status(500).json({ error: 'Failed to load capabilities' }); }
});

// POST /api/enquiry
router.post('/enquiry', (req, res) => {
  const { name, email, phone, company, product_interest, message } = req.body;
  if (!name || !email || !message)
    return res.status(400).json({ error: 'Name, email and message are required' });
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email))
    return res.status(400).json({ error: 'Invalid email address' });
  try {
    const item = db.createEnquiry({ name, email, phone: phone||'', company: company||'', product_interest: product_interest||'', message });
    res.json({ success: true, id: item.id, message: 'Enquiry submitted successfully. We will contact you within 24 hours.' });
  } catch { res.status(500).json({ error: 'Failed to submit enquiry' }); }
});

module.exports = router;
