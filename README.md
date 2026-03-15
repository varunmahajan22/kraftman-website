# Kraftman Packaging — Official Website

> **Print with Precision | Pack with Pride | Deliver with Trust**

Full-stack website for Kraftman Packaging with frontend, admin panel, image uploads, and SEO/AI-search optimisation.

---

## Quick Start (5 minutes)

### 1. Install Node.js
Download from https://nodejs.org — version 16 or higher.

### 2. Install dependencies
```bash
cd kraftman-website
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Open `.env` and set:
- `JWT_SECRET` → change to a long random string (important for security)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` → your admin credentials
- Port is `3000` by default

### 4. Start the server
```bash
npm start
```

### 5. Open in browser
| Page | URL |
|------|-----|
| Website | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |

Default admin login: `admin` / `KraftmanAdmin@2024`
**Change this immediately after first login.**

---

## File Structure

```
kraftman-website/
├── server.js              ← Main Express server
├── database.js            ← JSON-based data store (no install needed)
├── .env.example           ← Copy to .env and configure
├── package.json
│
├── routes/
│   ├── api.js             ← Public API (products, gallery, enquiries)
│   └── admin.js           ← Protected admin API (CRUD + uploads)
│
├── middleware/
│   └── auth.js            ← JWT authentication
│
├── public/                ← Frontend website (static files)
│   ├── index.html         ← Main website
│   ├── css/main.css
│   ├── js/main.js
│   ├── images/            ← Static images & placeholders
│   └── uploads/           ← Uploaded images (auto-created)
│
├── admin/
│   └── index.html         ← Admin panel (single-page app)
│
└── data/
    └── db.json            ← Database file (auto-created on first run)
```

---

## Admin Panel Features

| Section | What you can do |
|---------|----------------|
| **Dashboard** | Live stats: products, gallery items, enquiries |
| **Products** | Add / edit / delete products with image upload |
| **Gallery** | Upload portfolio images shown on website |
| **Enquiries** | View & manage contact form submissions |
| **Site Settings** | Update SEO title, description, phone, address, tagline |
| **Upload Images** | Bulk upload images, copy URLs to clipboard |
| **Change Password** | Secure password change |

---

## Image Upload

- **Formats:** JPG, PNG, GIF, WEBP
- **Max size:** 10 MB per image (configurable in `.env`)
- **Stored at:** `/public/uploads/` — served as `/uploads/filename.jpg`
- **Admin:** Upload → copy URL → paste into product or gallery

---

## API Endpoints

### Public (no auth required)
```
GET  /api/products                    All active products
GET  /api/products?category=X         Filtered by category
GET  /api/products/categories         All category names
GET  /api/gallery                     All active gallery images
GET  /api/settings                    Site settings
POST /api/enquiry                     Submit contact form
GET  /sitemap.xml                     SEO sitemap
GET  /robots.txt                      Search engine rules
GET  /health                          Health check
```

### Admin (Bearer JWT token required)
```
POST /admin/api/login                 Get JWT token
POST /admin/api/change-password       Change admin password
GET  /admin/api/stats                 Dashboard statistics

POST   /admin/api/upload              Upload single image
POST   /admin/api/upload/multiple     Upload multiple images

GET    /admin/api/products            All products (incl. inactive)
POST   /admin/api/products            Create product (multipart/form-data)
PUT    /admin/api/products/:id        Update product
DELETE /admin/api/products/:id        Delete product

GET    /admin/api/gallery             All gallery items
POST   /admin/api/gallery             Add gallery image
PUT    /admin/api/gallery/:id         Update gallery item
DELETE /admin/api/gallery/:id         Delete + remove file

GET    /admin/api/enquiries           All enquiries
PUT    /admin/api/enquiries/:id/status  Update status
DELETE /admin/api/enquiries/:id       Delete enquiry

GET /admin/api/settings               All site settings
PUT /admin/api/settings               Batch update settings
```

---

## SEO & AI Search Features

- **Structured data (JSON-LD):** Organization + LocalBusiness schema
- **Open Graph tags:** Rich previews on LinkedIn, WhatsApp, social
- **Dynamic sitemap.xml:** Auto-generated from live product data
- **robots.txt:** Allows all major crawlers incl. GPTBot, Claude-Web, PerplexityBot
- **Semantic HTML:** `<article>`, `<section>`, `<nav>`, ARIA labels
- **Meta tags:** Title, description, keywords, canonical URL
- **Performance:** Static file caching (7-day), gzip via reverse proxy

---

## Production Deployment (Recommended)

### Deploy on VPS / Cloud (e.g. AWS, DigitalOcean, Hostinger VPS)

1. Upload the folder to your server
2. Install Node.js and run `npm install`
3. Set up Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name kraftmanpackaging.com www.kraftmanpackaging.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /uploads/ {
        alias /path/to/kraftman-website/public/uploads/;
        expires 30d;
    }
}
```

4. Use PM2 to keep it running:
```bash
npm install -g pm2
pm2 start server.js --name kraftman
pm2 startup
pm2 save
```

5. Add SSL with Let's Encrypt:
```bash
certbot --nginx -d kraftmanpackaging.com -d www.kraftmanpackaging.com
```

---

## Customisation

**Add your product images:** Admin Panel → Products → Edit → Upload Image

**Add gallery images:** Admin Panel → Gallery → Add Image (or bulk upload via Upload Images tab)

**Update contact details:** Admin Panel → Site Settings

**Change brand colours:** Edit `public/css/main.css` — look for `:root { --clr-accent: #C8860A; ... }`

---

## Support

- Email: info@kraftmanpackaging.com
- Phone: +91-9717002464
