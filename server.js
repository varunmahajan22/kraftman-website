require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
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
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      // The 3D studio reads PDF artwork with pdf.js, which starts its parser from a blob: URL.
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://www.youtube.com", "https://youtube.com", "https://player.vimeo.com"],
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

// ─── MAINTENANCE MODE ──────────────────────────────────────────────────────────
// Serves public/maintenance.html instead of the site. Toggle it by creating or
// removing data/maintenance.flag — no restart, no code change:
//   touch data/maintenance.flag   → site shows "Under Renewal"
//   rm    data/maintenance.flag   → site back to normal
// MAINTENANCE_MODE=true in .env forces it on regardless of the flag file.
const MAINTENANCE_FLAG = path.join(__dirname, 'data', 'maintenance.flag');

function maintenanceOn() {
  if (String(process.env.MAINTENANCE_MODE).toLowerCase() === 'true') return true;
  try { return fs.existsSync(MAINTENANCE_FLAG); } catch { return false; }
}

// Stays reachable while the site is down: the admin panel (so the site can
// still be managed and the flag cleared), health checks, and the assets the
// maintenance page itself needs.
const MAINTENANCE_ALLOW = /^\/(admin|health|uploads|css|js|images|favicon|robots\.txt)/;

// Maintenance mode is for kraftmanpackaging.com ONLY. The ERP is a separate
// Next.js app on port 3001 and is already out of reach of this middleware, but
// this guard makes that a code guarantee rather than an nginx-config one: any
// request arriving with an ERP hostname is passed straight through.
const ERP_HOSTS = /^erp\./i;

app.use((req, res, next) => {
  const host = (req.hostname || '').toLowerCase();
  if (ERP_HOSTS.test(host)) return next();
  if (!maintenanceOn() || MAINTENANCE_ALLOW.test(req.path)) return next();
  // A signed preview link from the admin still opens its page, so the team can
  // check their work on the real server while the public sees "Under Renewal".
  if (previewing(req)) return next();
  // 503 + Retry-After is the correct signal for a temporary outage: search
  // engines hold the existing rankings instead of dropping the pages.
  res.status(503);
  res.setHeader('Retry-After', '3600');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.sendFile(path.join(__dirname, 'public', 'maintenance.html'));
});

// ─── PAGES ────────────────────────────────────────────────────────────────────
// Every page is rendered on the server (lib/render.js), so its content is in the
// HTML that search engines and AI assistants receive. Registered ahead of the
// static files.
const jwt = require('jsonwebtoken');
const { renderPage, renderNotFound, siteMap, context: siteContext, SITE_URL } = require('./lib/render');
const { credentialPhrase, plain } = require('./lib/site');
const { JWT_SECRET, requireAuth } = require('./middleware/auth');
require('./lib/store').migrate();   // once: the old product list becomes gallery photos under the six families
// A preview link from the admin shows a page's draft. It is signed, lasts an hour, and is never indexed.
const previewing = req => { try { return !!(req.query.preview && jwt.verify(String(req.query.preview), JWT_SECRET).preview); } catch (e) { return false; } };
const sendPage = (res, html, status) => {
  res.status(status || 200);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.type('html').send(html);
};
app.get('/', (req, res) => sendPage(res, renderPage('/', previewing(req))));
// The earlier addresses of the homepage.
app.get(['/v2', '/v2.html', '/index.html'], (req, res) => res.redirect(301, '/'));
app.get(['/studio', '/3d-studio', '/kraftman-studio'], (req, res) => res.redirect(301, '/studio.html'));
app.get(/^\/[a-z0-9\-\/]+$/, (req, res, next) => {
  // One address per page: /about/ is sent to /about.
  if (req.path.length > 1 && req.path.endsWith('/')) return res.redirect(301, req.path.replace(/\/+$/, ''));
  const html = renderPage(req.path, previewing(req));
  return html ? sendPage(res, html) : next();
});

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
const cms = require('./routes/cms');

app.use('/admin/api/login', authLimit);
app.use('/admin/api/cms', cms.router);
// Contact details and deleting enquiries are for owners; the marketing login cannot change them.
app.put('/admin/api/settings', requireAuth, cms.user, cms.ownerOnly);
app.delete('/admin/api/enquiries/:id', requireAuth, cms.user, cms.ownerOnly);
app.use('/admin/api', adminRouter);

// ─── SITEMAP.XML ──────────────────────────────────────────────────────────────
app.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${siteMap().map(p => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <lastmod>${today}</lastmod>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`);
});

// ─── ROBOTS.TXT ───────────────────────────────────────────────────────────────
// Search engines and AI assistants are welcome everywhere except the admin panel.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',          // OpenAI
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot',     // Anthropic
  'PerplexityBot', 'Perplexity-User',                 // Perplexity
  'Google-Extended', 'Applebot-Extended',             // Gemini, Apple Intelligence
  'Bingbot', 'CCBot', 'meta-externalagent',
];
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /admin

${AI_CRAWLERS.map(bot => `User-agent: ${bot}\nAllow: /\nDisallow: /admin`).join('\n\n')}

Sitemap: ${SITE_URL}/sitemap.xml
`);
});

// ─── LLMS.TXT ─────────────────────────────────────────────────────────────────
// A plain-language summary of the site for AI assistants (llmstxt.org), built
// from the same database as the pages so it never drifts from them.
app.get('/llms.txt', (req, res) => {
  const c = siteContext(), map = siteMap();
  const lines = [
    '# Kraftman Packaging',
    '',
    '> Kraftman Packaging Private Limited is a paperboard packaging manufacturer in Palwal, Haryana, India, in production since 2016. It prints and converts mono cartons, litho-laminated corrugated boxes, PDQ and retail displays, backer, header and blister cards, hangtags and rigid boxes, for consumer brands and for suppliers to large retail chains.',
    '',
    '## Key facts',
    '',
    '- Location: ' + c.address,
    c.phones.length ? '- Phone: ' + c.phones.join(', ') : null,
    c.email ? '- Email: ' + c.email : null,
    c.certs.length ? '- Certifications and audits: ' + credentialPhrase(c.certs) : null,
    '- Offset presses: Heidelberg CD 102, Heidelberg SM 52',
    '- Converting: Century MWB 1450 and MWZ 1450 die-cutters, three flute laminators, folder-gluers',
    '- Rigid box styles: lid and base, magnetic closure (book style), shoulder neck, drawer, collapsible',
    '- A fully automatic rigid box line is on order and not yet running',
    '',
    '## Pages',
    '',
    ...map.map(p => `- [${p.title}](${SITE_URL}${p.path}): ${p.about}`),
    '',
    '## Certifications and audits',
    '',
    ...c.certs.map(k => `- ${k.title}: ${k.body}`),
    '',
    '## Frequently asked questions',
    '',
    ...[].concat(...map.filter(p => p.page).map(p => p.page.faqs)).map(f => `### ${f.q}\n\n${plain(f.a)}\n`),
  ];
  res.type('text/plain; charset=utf-8').send(lines.filter(l => l !== null).join('\n'));
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

// ─── 404 ──────────────────────────────────────────────────────────────────────
// A real 404, so search engines do not index mistyped addresses as copies of the homepage.
app.get('*', (req, res) => sendPage(res, renderNotFound(), 404));

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
