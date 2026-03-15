require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust Nginx reverse proxy
app.set('trust proxy', 1);

// ─── SECURITY ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameSrc: ["https://www.youtube.com", "https://youtube.com", "https://player.vimeo.com"],
    },
  },
}));

app.use(cors({ origin: process.env.ALLOWED_ORIGINS || '*' }));

// Rate limiting
const generalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, message: { error: 'Too many requests' } });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Too many login attempts' } });
const enquiryLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Too many enquiry submissions' } });

app.use('/api', generalLimit);
app.use('/admin/api/login', generalLimit);

// ─── MIDDLEWARE ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files — HTML never cached, assets cached 7 days
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '7d',
  etag: true,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ─── INIT DB ───────────────────────────────────────────────────────────────────
require('./database'); // Initialize database on startup

// ─── ROUTES ───────────────────────────────────────────────────────────────────
const apiRouter = require('./routes/api');
const adminRouter = require('./routes/admin');

app.use('/api', apiRouter);
app.use('/admin/api/login', authLimit);
app.use('/admin/api', adminRouter);

// ─── SITEMAP.XML ──────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const db = require('./database');
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const products = db.getProducts(true);

  const staticPages = [
    { loc: baseUrl, priority: '1.0', changefreq: 'weekly' },
    { loc: `${baseUrl}/#about`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${baseUrl}/#products`, priority: '0.9', changefreq: 'weekly' },
    { loc: `${baseUrl}/#gallery`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${baseUrl}/#contact`, priority: '0.8', changefreq: 'monthly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
        http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticPages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <priority>${p.priority}</priority>
    <changefreq>${p.changefreq}</changefreq>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

// ─── ROBOTS.TXT ───────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/api
Disallow: /uploads/

# AI Crawlers
User-agent: GPTBot
Allow: /
Disallow: /admin

User-agent: Claude-Web
Allow: /
Disallow: /admin

User-agent: PerplexityBot
Allow: /
Disallow: /admin

User-agent: Bingbot
Allow: /

Sitemap: ${baseUrl}/sitemap.xml`);
});

// ─── SERVE ADMIN SPA ──────────────────────────────────────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ─── 404 → SPA FALLBACK ───────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `File too large. Maximum ${process.env.MAX_FILE_SIZE_MB || 10}MB allowed.` });
  }
  console.error('Server error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Kraftman Packaging Website running at http://localhost:${PORT}`);
  console.log(`📊 Admin Panel: http://localhost:${PORT}/admin`);
  console.log(`🔑 Default admin: admin / KraftmanAdmin@2024\n`);
});

module.exports = app;
