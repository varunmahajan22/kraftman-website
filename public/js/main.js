/**
 * Kraftman Packaging — Main Frontend JS v7
 * Features: Nav, Counters, Products, Gallery, Lightbox, Form, Scroll,
 *           Clients, Certifications, Capabilities, Section Backgrounds
 */

/* ── NAV ─────────────────────────────────────────────────────────── */
const header    = document.getElementById('header');
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');

hamburger?.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.classList.toggle('active', open);
  hamburger.setAttribute('aria-expanded', String(open));
});

// Close nav on link click (mobile)
navLinks?.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
  });
});

// Sticky header shadow + scroll-top visibility
window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 10);
  if (scrollTopBtn) {
    scrollTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
  }
}, { passive: true });

// Active nav link on scroll
const sections = document.querySelectorAll('section[id]');
const navItems = document.querySelectorAll('.nav-link[data-section]');

const observerNav = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navItems.forEach(n => {
        n.classList.toggle('active', n.dataset.section === e.target.id);
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => observerNav.observe(s));

/* ── SCROLL TO TOP ─────────────────────────────────────────────── */
const scrollTopBtn = document.getElementById('scrollTop');
scrollTopBtn?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

/* ── FOOTER YEAR ────────────────────────────────────────────────── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ── COUNTER ANIMATION ─────────────────────────────────────────── */
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const start = performance.now();
  const update = (now) => {
    const pct = Math.min((now - start) / duration, 1);
    const ease = 1 - Math.pow(1 - pct, 3); // ease-out cubic
    el.textContent = Math.floor(ease * target);
    if (pct < 1) requestAnimationFrame(update);
    else el.textContent = target;
  };
  requestAnimationFrame(update);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.querySelectorAll('[data-target]').forEach(animateCounter);
      statsObserver.unobserve(e.target);
    }
  });
});
const heroStatsEl = document.getElementById('heroStatsGrid');
heroStatsEl && statsObserver.observe(heroStatsEl);

/* ── FADE IN ON SCROLL ─────────────────────────────────────────── */
document.querySelectorAll('.section > .container').forEach(el => {
  el.classList.add('fade-in');
});
const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      fadeObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.05 });
document.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));

/* ── PRODUCT LIGHTBOX ───────────────────────────────────────────── */
window._prodGalleries = {};
var _lbImgs = [], _lbIdx = 0;

function openProdLightbox(productId) {
  var imgs = window._prodGalleries[productId];
  if (!imgs || !imgs.length) return;
  _lbImgs = imgs;
  _lbIdx = 0;
  var lb = document.getElementById('prodLightbox');
  lb.classList.add('lb-open');
  document.body.style.overflow = 'hidden';
  _lbRender();
}
function closeProdLightbox() {
  var lb = document.getElementById('prodLightbox');
  lb.classList.remove('lb-open');
  document.body.style.overflow = '';
}
function _lbRender() {
  document.getElementById('lbMainImg').src = _lbImgs[_lbIdx];
  document.getElementById('lbMainImg').alt = 'Product image ' + (_lbIdx + 1);
  document.getElementById('lbCounter').textContent = (_lbIdx + 1) + ' / ' + _lbImgs.length;
  document.getElementById('lbThumbs').innerHTML = _lbImgs.map(function(s, i) {
    return '<img src="' + s + '" class="lb-thumb' + (i === _lbIdx ? ' lb-active' : '') + '" onclick="_lbGoTo(' + i + ')" alt="Thumbnail ' + (i+1) + '" />';
  }).join('');
  // Hide arrows if only one image
  var showArrows = _lbImgs.length > 1;
  document.querySelector('.lb-arrow-prev').style.display = showArrows ? '' : 'none';
  document.querySelector('.lb-arrow-next').style.display = showArrows ? '' : 'none';
}
function _lbGoTo(i) { _lbIdx = i; _lbRender(); }
function _lbPrev() { _lbIdx = (_lbIdx - 1 + _lbImgs.length) % _lbImgs.length; _lbRender(); }
function _lbNext() { _lbIdx = (_lbIdx + 1) % _lbImgs.length; _lbRender(); }

document.addEventListener('keydown', function(e) {
  var lb = document.getElementById('prodLightbox');
  if (lb && lb.classList.contains('lb-open')) {
    if (e.key === 'Escape') closeProdLightbox();
    if (e.key === 'ArrowLeft') _lbPrev();
    if (e.key === 'ArrowRight') _lbNext();
  }
});
// Close on backdrop click
document.addEventListener('DOMContentLoaded', function() {
  var lb = document.getElementById('prodLightbox');
  if (lb) lb.addEventListener('click', function(e) {
    if (e.target === lb) closeProdLightbox();
  });
});

/* ── PRODUCTS ───────────────────────────────────────────────────── */
let allProducts = [];
let activeCategory = 'all';

const productsGrid = document.getElementById('productsGrid');
const filterBtns   = document.querySelectorAll('.filter-btn');

async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Failed to load');
    allProducts = await res.json();
    renderProducts();
  } catch (e) {
    if (productsGrid) {
      productsGrid.innerHTML = renderDefaultProducts();
    }
  }
}

function renderDefaultProducts() {
  const defaults = [
    { category: 'Mono Cartons', name: 'Retail Mono Carton', description: 'Premium printed mono cartons for FMCG and retail with vibrant color, UV, lamination and foiling options. Environmentally friendly paperboard.', image_url: null },
    { category: 'Mono Cartons', name: 'Pharmaceutical Carton', description: 'Precision-printed pharmaceutical packaging with compliance-grade structural integrity and tamper-evident features.', image_url: null },
    { category: 'Mono Cartons', name: 'Cosmetics Packaging', description: 'Luxury cosmetics cartons with hot foil stamping, embossing, and premium surface finishes for high-end brands.', image_url: null },
    { category: 'Corrugated Solutions', name: 'Master Shipper Carton', description: 'Heavy-duty corrugated boxes, A/B/C/E flute up to 5-ply, maximum 1400mm width for transit protection.', image_url: null },
    { category: 'Corrugated Solutions', name: 'E-Commerce Box', description: 'Right-sized e-commerce packaging with branded 2-colour direct corrugated print. Optimised for automated fulfilment.', image_url: null },
    { category: 'Display Boxes', name: 'PDQ Display Unit', description: 'Point-of-purchase displays engineered for retail shelf visibility and product merchandising effectiveness.', image_url: null },
    { category: 'Litho Laminated', name: 'Litho Laminated Box', description: 'High-quality litho print laminated onto corrugated board for luxury product presentation at scale.', image_url: null },
    { category: 'Hangtags & Labels', name: 'Custom Hangtag', description: 'Brand-differentiated hangtags for apparel and retail with premium finishes, embossing, and foiling.', image_url: null },
    { category: 'Bellybands & Inserts', name: 'Decorative Bellyband', description: 'Functional and decorative bellybands and inserts for premium retail product presentation and gifting.', image_url: null },
  ];
  allProducts = defaults;
  return buildProductCards(defaults);
}

function buildProductCards(products) {
  if (!products.length) {
    return '<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--clr-muted)">No products found in this category.</div>';
  }
  return products.map(p => {
    // Lightbox uses ONLY gallery_images (full-size, fit:inside — not cropped)
    var lightboxImgs = [];
    try {
      var gal = JSON.parse(p.gallery_images || '[]');
      gal.forEach(function(u) { if (u) lightboxImgs.push(u); });
    } catch(e) {}
    var hasGallery = lightboxImgs.length > 0;
    // Store for lightbox access (gallery images only, not the cropped card thumbnail)
    window._prodGalleries[p.id] = lightboxImgs;

    // Card thumbnail uses image_url (cropped 4:3 for consistent card layout)
    var cardImg = p.image_url && p.image_url !== '/images/placeholder-product.svg' ? p.image_url : null;
    var imgHtml = cardImg
      ? '<img src="' + escHtml(cardImg) + '" alt="' + escHtml(p.name) + '" loading="lazy" />'
      : '<div class="product-img-placeholder"><i class="fa fa-box"></i></div>';

    var galleryExtras = hasGallery
      ? '<div class="prod-img-count"><i class="fa fa-images"></i> ' + lightboxImgs.length + '</div>'
        + '<div class="prod-view-hint"><i class="fa fa-search-plus prod-view-hint-icon"></i></div>'
      : '';

    var imgDiv = hasGallery
      ? '<div class="product-img has-gallery" onclick="openProdLightbox(' + p.id + ')">' + imgHtml + galleryExtras + '</div>'
      : '<div class="product-img">' + imgHtml + '</div>';

    return '<article class="product-card" data-cat="' + escHtml(p.category) + '">'
      + imgDiv
      + '<div class="product-body">'
      + '<div class="product-cat">' + escHtml(p.category) + '</div>'
      + '<h3 class="product-name">' + escHtml(p.name) + '</h3>'
      + '<p class="product-desc">' + escHtml(p.description || '') + '</p>'
      + '<div style="margin-top:16px;display:flex;align-items:center;gap:10px;">'
      + '<a href="#contact" class="btn btn-primary" style="padding:9px 18px;font-size:.75rem;"><i class="fa fa-paper-plane"></i> Request Quote</a>'
      + (hasGallery ? '<button onclick="openProdLightbox(' + p.id + ')" style="background:none;border:1px solid var(--clr-border);border-radius:6px;padding:8px 14px;font-size:.75rem;cursor:pointer;color:var(--clr-muted);display:flex;align-items:center;gap:5px;"><i class="fa fa-images"></i> ' + lightboxImgs.length + ' Photos</button>' : '')
      + '</div>'
      + '</div>'
      + '</article>';
  }).join('');
}

function renderProducts() {
  if (!productsGrid) return;
  const filtered = activeCategory === 'all'
    ? allProducts
    : allProducts.filter(p => p.category === activeCategory);
  productsGrid.innerHTML = buildProductCards(filtered);
}

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    activeCategory = btn.dataset.cat;
    renderProducts();
  });
});

loadProducts();

/* ── GALLERY ────────────────────────────────────────────────────── */
let galleryItems = [];
const galleryGrid = document.getElementById('galleryGrid');

async function loadGallery() {
  try {
    const res = await fetch('/api/gallery');
    if (!res.ok) throw new Error('No gallery');
    galleryItems = await res.json();
    if (galleryItems.length > 0) renderGallery();
  } catch (e) { /* Keep default placeholder */ }
}

function renderGallery() {
  if (!galleryGrid || !galleryItems.length) return;
  galleryGrid.innerHTML = `<div class="gallery-real-grid">
    ${galleryItems.map((item, i) => `
      <div class="gallery-item" data-index="${i}" onclick="openLightbox(${i})" role="button" tabindex="0" aria-label="${escHtml(item.title || item.alt_text || 'Gallery image')}">
        <img src="${escHtml(item.image_url)}" alt="${escHtml(item.alt_text || item.title || 'Kraftman Packaging')}" loading="lazy" />
      </div>
    `).join('')}
  </div>`;
}

loadGallery();

/* ── LIGHTBOX ────────────────────────────────────────────────────── */
const lightbox    = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');
const lightboxCap = document.getElementById('lightboxCaption');
let lightboxIndex = 0;

function openLightbox(index) {
  if (!galleryItems.length) return;
  lightboxIndex = index;
  updateLightbox();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
function updateLightbox() {
  const item = galleryItems[lightboxIndex];
  lightboxImg.src = item.image_url;
  lightboxImg.alt = item.alt_text || item.title || 'Kraftman Packaging';
  lightboxCap.textContent = item.title || '';
}

document.getElementById('lightboxClose')?.addEventListener('click', closeLightbox);
document.getElementById('lightboxPrev')?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex - 1 + galleryItems.length) % galleryItems.length;
  updateLightbox();
});
document.getElementById('lightboxNext')?.addEventListener('click', () => {
  lightboxIndex = (lightboxIndex + 1) % galleryItems.length;
  updateLightbox();
});
lightbox?.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (!lightbox?.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') {
    lightboxIndex = (lightboxIndex - 1 + galleryItems.length) % galleryItems.length;
    updateLightbox();
  }
  if (e.key === 'ArrowRight') {
    lightboxIndex = (lightboxIndex + 1) % galleryItems.length;
    updateLightbox();
  }
});

/* ── CONTACT FORM ────────────────────────────────────────────────── */
const contactForm  = document.getElementById('contactForm');
const formFeedback = document.getElementById('formFeedback');
const submitBtn    = document.getElementById('submitBtn');

contactForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(contactForm));

  // Client-side validation
  if (!data.name?.trim() || !data.email?.trim() || !data.message?.trim()) {
    showFeedback('error', 'Please fill in all required fields (Name, Email, Message).');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending…';

  try {
    const res = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (res.ok && result.success) {
      showFeedback('success', '✅ ' + result.message);
      contactForm.reset();
    } else {
      showFeedback('error', result.error || 'Something went wrong. Please try again.');
    }
  } catch {
    showFeedback('error', 'Network error. Please try again or call us directly.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa fa-paper-plane"></i> Send Enquiry';
  }
});

function showFeedback(type, msg) {
  if (!formFeedback) return;
  formFeedback.className = 'form-feedback ' + type;
  formFeedback.textContent = msg;
  formFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => {
    formFeedback.className = 'form-feedback';
    formFeedback.textContent = '';
  }, 8000);
}

/* ── CLIENT LOGOS ────────────────────────────────────────────────── */
const clientLogosGrid = document.getElementById('clientLogosGrid');

async function loadClients() {
  try {
    const res = await fetch('/api/clients');
    if (!res.ok) throw new Error('No clients');
    const clients = await res.json();
    if (clients.length > 0) renderClientLogos(clients);
  } catch (e) { /* grid stays hidden if no clients */ }
}

function renderClientLogos(clients) {
  if (!clientLogosGrid || !clients.length) return;
  clientLogosGrid.innerHTML = clients.map(c => {
    const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const href = c.website ? ` href="${escHtml(c.website)}" target="_blank" rel="noopener"` : '';
    const tag = c.website ? 'a' : 'div';
    if (c.logo_url) {
      return `<${tag} class="client-logo-card"${href} title="${escHtml(c.name)}">
        <img src="${escHtml(c.logo_url)}" alt="${escHtml(c.name)} logo" loading="lazy" />
      </${tag}>`;
    } else {
      return `<${tag} class="client-logo-card no-logo"${href}>
        <div class="client-logo-placeholder">${escHtml(initials)}</div>
      </${tag}>`;
    }
  }).join('');
}

loadClients();

/* ── CERTIFICATIONS ──────────────────────────────────────────────── */
const certificationsGrid = document.getElementById('certificationsGrid');

async function loadCertifications() {
  try {
    const res = await fetch('/api/certifications');
    if (!res.ok) throw new Error('No certifications');
    const certs = await res.json();
    renderCertifications(certs);
  } catch (e) {
    if (certificationsGrid) certificationsGrid.innerHTML = '';
  }
}

function renderCertifications(certs) {
  if (!certificationsGrid) return;
  if (!certs.length) { certificationsGrid.innerHTML = ''; return; }
  certificationsGrid.innerHTML = certs.map(c => {
    const imageHtml = c.image_url
      ? `<img src="${escHtml(c.image_url)}" alt="${escHtml(c.title)}" class="cert-card-image" loading="lazy" />`
      : `<div class="cert-icon-wrap"><i class="fa ${escHtml(c.badge_icon || 'fa-certificate')}"></i></div>`;
    return `<div class="cert-card fade-in">
      ${imageHtml}
      <h3 class="cert-card-title">${escHtml(c.title)}</h3>
      <p class="cert-card-body">${escHtml(c.body)}</p>
    </div>`;
  }).join('');
  certificationsGrid.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
}

loadCertifications();

/* ── CAPABILITIES ────────────────────────────────────────────────── */
const CAPABILITY_DEFAULTS = [
  { sort_order:1, icon:'fa-pencil-ruler', title:'Pre-Press & Design',    description:'ESKO suite & Artios CAD structural design, 3D rendering & photorealistic visualization, dieline development, ICC color management & preflight.' },
  { sort_order:2, icon:'fa-print',        title:'Precision Printing',     description:'Heidelberg multicolor offset presses, GMI-compliant color management, X-Rite i1 inline monitoring, tight ΔE control, direct flexo for corrugated.' },
  { sort_order:3, icon:'fa-cut',          title:'Post-Press & Finishing', description:'Flatbed die-cutting up to 52"×72", UV & blister coating, folder-gluing with inline QC, window patching, corrugation A/B/C/E flute up to 5-ply.' },
  { sort_order:4, icon:'fa-shield-alt',   title:'Quality Assurance',      description:'Multi-stage inspection, burst strength & compression testing, transit & drop simulation, ISO / BRC / FSC compliance, Six Sigma & lean manufacturing.' }
];

async function loadCapabilities() {
  const grid = document.getElementById('capabilitiesGrid');
  if (!grid) return;
  // If the grid has static HTML content (quality cards), don't override it
  if (grid.children.length > 0 && !grid.querySelector('.cert-card-loading')) return;
  let caps = CAPABILITY_DEFAULTS;
  try {
    const res = await fetch('/api/capabilities');
    if (res.ok) {
      const data = await res.json();
      if (data.length) caps = data;
    }
  } catch {}
  grid.innerHTML = caps.map((c, i) => {
    const num = String(i + 1).padStart(2, '0');
    const icon = c.icon || 'fa-cog';
    const imageHtml = c.image_url
      ? `<img src="${escHtml(c.image_url)}" alt="${escHtml(c.title)}" class="cap-card-image" loading="lazy">`
      : '';
    return `<div class="cap-card fade-in">
      ${imageHtml}
      <div class="cap-number">${num}</div>
      <div class="cap-icon"><i class="fa ${escHtml(icon)}"></i></div>
      <div class="cap-title">${escHtml(c.title)}</div>
      <p class="cap-desc">${escHtml(c.description)}</p>
    </div>`;
  }).join('');
  grid.querySelectorAll('.fade-in').forEach(el => fadeObserver.observe(el));
}
loadCapabilities();

/* ── SECTION BACKGROUND HELPER ───────────────────────────────────── */
function applySecBg(selector, url, overlayColor) {
  var el = document.querySelector(selector);
  if (!el || !url) return;
  el.style.backgroundImage = 'url(' + url + ')';
  el.style.backgroundSize = 'cover';
  el.style.backgroundPosition = 'center';
  el.style.backgroundRepeat = 'no-repeat';
  el.style.position = 'relative';
  el.classList.add('has-bg');
  // inject overlay div if not already present
  var ov = el.querySelector('.sec-bg-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'sec-bg-overlay';
    ov.style.position = 'absolute';
    ov.style.top = '0';
    ov.style.left = '0';
    ov.style.right = '0';
    ov.style.bottom = '0';
    ov.style.pointerEvents = 'none';
    ov.style.zIndex = '0';
    el.insertBefore(ov, el.firstChild);
  }
  ov.style.background = overlayColor;
  // ensure direct .container is above overlay
  var cont = el.querySelector('.container');
  if (cont) { cont.style.position = 'relative'; cont.style.zIndex = '1'; }
}

/* ── SECTION BACKGROUNDS (from settings) ────────────────────────── */
async function loadSectionBgs() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) return;
    const s = await res.json();
    if (s.site_logo) {
      const logoLink = document.querySelector('a.nav-logo');
      if (logoLink) {
        logoLink.innerHTML = `<img src="${s.site_logo}" alt="Kraftman Packaging" style="height:44px;max-width:180px;object-fit:contain;display:block;">`;
      }
    }
    if (s.hero_bg_image) {
      const el = document.querySelector('.hero-visual-bg');
      if (el) el.style.backgroundImage = `url('${s.hero_bg_image}')`;
    }
    if (s.about_bg_image) {
      const el = document.querySelector('.about-section');
      if (el) {
        el.style.backgroundImage = `url('${s.about_bg_image}')`;
        el.classList.add('has-bg');
      }
    }
    if (s.npd_bg_image) {
      const el = document.querySelector('.npd-section');
      if (el) {
        el.style.backgroundImage = `url('${s.npd_bg_image}')`;
        el.classList.add('has-bg');
      }
    }
    if (s.about_visual_image) {
      const el = document.querySelector('.about-visual-main');
      if (el) {
        el.style.backgroundImage = `url('${s.about_visual_image}')`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        const icon = el.querySelector('.about-img-placeholder');
        if (icon) icon.style.display = 'none';
        const grid = el.querySelector('.about-visual-grid');
        if (grid) grid.style.opacity = '0.3';
      }
    }
    if (s.capabilities_bg_image) {
      const el = document.querySelector('.capabilities-section');
      if (el) {
        el.style.backgroundImage = `url('${s.capabilities_bg_image}')`;
        el.classList.add('has-bg');
      }
    }
    // Render dynamic page sections first, then apply section backgrounds
    renderSectionStrengths(s);
    renderSectionMfg(s);
    renderSectionNpd(s);
    renderSectionQuality(s);
    renderSectionWhyUs(s);
    renderNpdVideo(s);
    // Apply section backgrounds AFTER renders so they are never overwritten
    var lightOverlay = 'rgba(255,255,255,0.35)';
    var darkOverlay  = 'rgba(10,22,36,0.72)';
    applySecBg('.strengths-section',      s.strengths_bg_image,      lightOverlay);
    applySecBg('.manufacturing-section',  s.manufacturing_bg_image,  darkOverlay);
    applySecBg('.products-section',       s.products_bg_image,       lightOverlay);
    applySecBg('.quality-section',        s.quality_bg_image,        lightOverlay);
    applySecBg('.clients-section',        s.clients_bg_image,        lightOverlay);
    applySecBg('.whyus-section',          s.whyus_bg_image,          darkOverlay);
    applySecBg('.certifications-section', s.certifications_bg_image, lightOverlay);
    applySecBg('.contact-section',        s.contact_bg_image,        lightOverlay);
  } catch(e) { console.error('loadSectionBgs error:', e); }
}
loadSectionBgs();

function renderNpdVideo(s) {
  const outer = document.getElementById('npdVideoOuter');
  const section = document.getElementById('npd-video');
  if (!outer || !section) return;
  const url = (s.npd_video_url || '').trim();
  if (!url) { section.style.display = 'none'; return; }
  section.style.display = '';

  // Detect YouTube / Vimeo → embed as iframe; otherwise use <video>
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  const vmMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);

  if (ytMatch) {
    outer.innerHTML = `<div class="npd-video-frame-wrap">
      <iframe src="https://www.youtube.com/embed/${ytMatch[1]}?rel=0&modestbranding=1" title="Sampling, Rendering &amp; Testing" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  } else if (vmMatch) {
    outer.innerHTML = `<div class="npd-video-frame-wrap">
      <iframe src="https://player.vimeo.com/video/${vmMatch[1]}?title=0&byline=0&portrait=0" title="Sampling, Rendering &amp; Testing" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
    </div>`;
  } else {
    outer.innerHTML = `<div class="npd-video-frame-wrap">
      <video controls playsinline preload="metadata">
        <source src="${escHtml(url)}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    </div>`;
  }
}

/* ── DYNAMIC SECTION RENDERERS ──────────────────────────────────── */
function parseSectionJson(s, key, defaults) {
  try { if (s[key]) return JSON.parse(s[key]); } catch {}
  return defaults;
}

function renderSectionStrengths(s) {
  const grid = document.getElementById('strengthsGrid');
  if (!grid) return;
  const defaults = [
    { label: 'Strength One', title: 'Quality Excellence', description: 'Die-hard determination to serve clients with utmost quality through rigorous standards and continuous improvement at every stage of production.' },
    { label: 'Strength Two', title: 'Professional Team', description: 'Qualified professionals oriented to examine the minutest details, ensuring no loose ends in manufacturing and quality assurance processes.' },
    { label: 'Strength Three', title: 'Client Trust', description: 'Our strength is derived from the immense trust clients place in us, built through consistent delivery, reliability, and transparent communication.' },
    { label: 'Strength Four', title: 'Technical Capability', description: 'Advanced manufacturing infrastructure combined with engineering expertise to deliver complex packaging solutions efficiently and at scale.' }
  ];
  const items = parseSectionJson(s, 'strengths_data', defaults);
  grid.innerHTML = items.map((item, i) => `
    <div class="strength-card">
      <div class="strength-number">${String(i + 1).padStart(2, '0')}</div>
      <div class="strength-body">
        <div class="strength-label">${escHtml(item.label || '')}</div>
        <h3 class="strength-title">${escHtml(item.title)}</h3>
        <p class="strength-desc">${escHtml(item.description || '')}</p>
      </div>
    </div>`).join('');
}

function renderSectionMfg(s) {
  const grid = document.getElementById('mfgGrid');
  if (!grid) return;
  const defaults = [
    { step_num: '01', icon: 'fa-pencil-ruler', title: 'Pre-Press & Design', description: 'ESKO suite & Artios CAD structural design, 3D rendering & photorealistic visualization, dieline development, ICC color management & preflight, rapid prototyping via sample maker, and Adobe Creative Suite.', features: ['ESKO Suite & Artios CAD', '3D Rendering & Visualization', 'ICC Color Management', 'Rapid Prototyping'], image_url: '/uploads/1772778589508-452603.jpg' },
    { step_num: '02', icon: 'fa-print', title: 'Precision Printing', description: 'Heidelberg multicolor offset presses, GMI-compliant color management, X-Rite i1 & PressSign inline monitoring, tight ΔE color control, and 2-color direct corrugated flexo printing.', features: ['Heidelberg Offset Presses', 'GMI-Compliant Color Mgmt', 'Tight ΔE Color Control', 'X-Rite i1 Inline Monitoring'], image_url: '/uploads/1772778913655-551648.jpg' },
    { step_num: '03', icon: 'fa-cut', title: 'Post-Press & Finishing', description: 'Flatbed die-cutting up to 52\u201d×72\u201d, UV & blister coating, folder-gluing with inline QC, window patching, corrugation A/B/C/E flute up to 5-ply, maximum board width 1400mm.', features: ['Die-Cutting up to 52\u201d×72\u201d', 'UV & Blister Coating', 'A/B/C/E Flute up to 5-Ply', 'Inline QC Folder-Gluers'], image_url: '/uploads/1772778925890-506904.jpg' }
  ];
  const items = parseSectionJson(s, 'mfg_steps_data', defaults);
  grid.innerHTML = items.map((item, i) => `
    ${i > 0 ? '<div class="mfg-divider"></div>' : ''}
    <div class="mfg-col"${item.image_url ? ` style="background-image:url('${escHtml(item.image_url)}')"` : ''}>
      <div class="mfg-step-num">${escHtml(item.step_num || String(i + 1).padStart(2, '0'))}</div>
      <div class="mfg-icon"><i class="fa ${escHtml(item.icon || 'fa-cog')}"></i></div>
      <h3 class="mfg-title">${escHtml(item.title)}</h3>
      <p class="mfg-desc">${escHtml(item.description || '')}</p>
      ${item.features && item.features.length ? `<ul class="mfg-features">${item.features.map(f => `<li><i class="fa fa-check"></i> ${escHtml(f)}</li>`).join('')}</ul>` : ''}
    </div>`).join('');
}

function renderSectionNpd(s) {
  const grid = document.getElementById('npdGrid');
  if (!grid) return;
  const defaults = [
    { number: '01', icon: 'fa-cube', title: 'Sample Maker', description: 'Advanced technology for rapid prototyping — quick, accurate physical prototypes with drastic reduction in manual labor and development time.' },
    { number: '02', icon: 'fa-eye', title: '3D Rendering', description: 'Seamless integration using 3D renderings as references for sample maker prototypes — virtual approval before physical production begins.' },
    { number: '03', icon: 'fa-truck', title: 'Transit Testing', description: 'Rigorous testing integrated into the development process — ensuring product safety and durability during transit before launch.' }
  ];
  const items = parseSectionJson(s, 'npd_steps_data', defaults);
  grid.innerHTML = items.map((item, i) => `
    ${i > 0 ? '<div class="npd-connector"><i class="fa fa-chevron-right"></i></div>' : ''}
    <div class="npd-card">
      ${item.image_url ? `<img class="npd-card-img" src="${escHtml(item.image_url)}" alt="${escHtml(item.title)}" loading="lazy">` : ''}
      <div class="npd-number">${escHtml(item.number || String(i + 1).padStart(2, '0'))}</div>
      <div class="npd-icon-wrap"><i class="fa ${escHtml(item.icon || 'fa-cog')}"></i></div>
      <h3 class="npd-title">${escHtml(item.title)}</h3>
      <p class="npd-desc">${escHtml(item.description || '')}</p>
    </div>`).join('');
}

function renderSectionQuality(s) {
  const grid = document.getElementById('qualityGrid');
  if (!grid) return;
  const defaults = [
    { icon: 'fa-flask', title: 'Quality Control Laboratory', description: 'State-of-the-art testing facilities with comprehensive material testing protocols. ISO-compliant procedures for every batch.' },
    { icon: 'fa-search', title: 'Inspection Systems', description: 'Multi-stage inspection process with automated quality checks and manual verification. Real-time defect detection throughout production.' },
    { icon: 'fa-shield-alt', title: 'Compliance & Standards', description: 'ISO, BRC, and FSC adherence with regular third-party audits and fully documented Quality Management System.' },
    { icon: 'fa-vials', title: 'Testing Capabilities', description: 'Burst strength, compression, and durability testing; color consistency verification; transit and drop test simulations.' },
    { icon: 'fa-chart-line', title: 'Continuous Improvement', description: 'Six Sigma and lean manufacturing methodologies, root cause analysis, and ongoing employee training programs.' }
  ];
  const items = parseSectionJson(s, 'quality_items_data', defaults);
  grid.innerHTML = items.map(item => `
    <div class="quality-card">
      <div class="quality-icon"><i class="fa ${escHtml(item.icon || 'fa-check')}"></i></div>
      <h3 class="quality-title">${escHtml(item.title)}</h3>
      <p class="quality-desc">${escHtml(item.description || '')}</p>
    </div>`).join('');
}

function renderSectionWhyUs(s) {
  const grid = document.getElementById('whyusGrid');
  if (!grid) return;
  const defaults = [
    { icon: 'fa-cogs', title: 'Advanced Manufacturing', description: 'State-of-the-art Heidelberg presses, CTP technology, and automated finishing lines ensure precision, repeatability, and efficiency at scale.' },
    { icon: 'fa-check-double', title: 'GMI-Certified Quality', description: 'Equipped testing laboratory with rigorous multi-stage quality control at every production phase. Tight ΔE color control across long runs.' },
    { icon: 'fa-bolt', title: 'Reduced Turnaround', description: 'Sample maker + 3D rendering integration dramatically reduces development cycles. Rapid prototyping with quick physical mock-ups.' },
    { icon: 'fa-leaf', title: 'Sustainability Focus', description: 'FSC-certified materials, eco-friendly paperboard, and sustainable manufacturing practices throughout every step of production.' },
    { icon: 'fa-users', title: 'Expert Team', description: 'Qualified professionals in design, engineering, quality control, and customer service — detail-oriented at every stage.' },
    { icon: 'fa-handshake', title: 'Client Partnership', description: 'Collaborative approach with a proven track record delivering customized solutions that meet specific client requirements and brand standards.' }
  ];
  const items = parseSectionJson(s, 'whyus_items_data', defaults);
  grid.innerHTML = items.map((item, i) => `
    <div class="why-card">
      <div class="why-number">${String(i + 1).padStart(2, '0')}</div>
      <div class="why-icon"><i class="fa ${escHtml(item.icon || 'fa-star')}"></i></div>
      <h3 class="why-title">${escHtml(item.title)}</h3>
      <p class="why-desc">${escHtml(item.description || '')}</p>
    </div>`).join('');
}

/* ── UTILS ───────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Smooth scroll for all anchor links
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const id = link.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (target) {
      e.preventDefault();
      const offset = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 74;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
