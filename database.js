/**
 * Lightweight JSON-based database (no native SQLite bindings required)
 * Drop-in replacement using file-based persistence with synchronous API
 */
const fs   = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

/* ── SCHEMA DEFAULTS ──────────────────────────────────────────────── */
const defaultDB = {
  admins: [],
  products: [],
  gallery: [],
  enquiries: [],
  site_settings: {},
  testimonials: [],
  clients: [],
  certifications: [],
  capabilities: [],
  _counters: { admins: 0, products: 0, gallery: 0, enquiries: 0, testimonials: 0, clients: 0, certifications: 0, capabilities: 0 }
};

/* ── LOAD / SAVE ─────────────────────────────────────────────────── */
function load() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return JSON.parse(JSON.stringify(defaultDB)); }
}
function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

/* ── INIT ────────────────────────────────────────────────────────── */
let db = load();

// Ensure all tables exist
Object.keys(defaultDB).forEach(k => { if (db[k] === undefined) db[k] = defaultDB[k]; });

// ── MIGRATIONS: repair counters and null ids from old db format ───
const allTables = ['admins', 'products', 'gallery', 'enquiries', 'testimonials', 'clients', 'certifications', 'capabilities'];
allTables.forEach(table => {
  if (!db._counters[table] || isNaN(db._counters[table])) {
    // Rebuild counter from the actual max id in the array
    const maxId = (db[table] || []).reduce((m, item) => {
      const n = parseInt(item.id);
      return isNaN(n) ? m : Math.max(m, n);
    }, 0);
    db._counters[table] = maxId;
  }
  // Fix any items with null/NaN/undefined ids
  if (db[table]) {
    let needsRepair = db[table].some(item => !item.id || isNaN(item.id));
    if (needsRepair) {
      let nextId = db._counters[table] || 0;
      db[table].forEach(item => {
        if (!item.id || isNaN(item.id)) { item.id = ++nextId; }
      });
      db._counters[table] = nextId;
      console.log(`✅ Repaired ids in ${table} table`);
    }
  }
});

// Seed default admin
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'KraftmanAdmin@2024';
if (!db.admins.find(a => a.username === adminUsername)) {
  db._counters.admins = (db._counters.admins || 0) + 1;
  db.admins.push({ id: db._counters.admins, username: adminUsername, password_hash: bcrypt.hashSync(adminPassword, 12), created_at: new Date().toISOString() });
  console.log(`✅ Admin created: ${adminUsername}`);
}

// Seed default products
if (!db.products.length) {
  const now = new Date().toISOString();
  const products = [
    { category: 'Mono Cartons', name: 'Retail Mono Carton', description: 'Premium printed mono cartons with vibrant color, UV, lamination and foiling options for FMCG and retail.', image_url: '/images/placeholder-product.svg', sort_order: 1, is_active: 1 },
    { category: 'Mono Cartons', name: 'Pharmaceutical Carton', description: 'Compliance-grade pharmaceutical packaging with precision printing and structural integrity.', image_url: '/images/placeholder-product.svg', sort_order: 2, is_active: 1 },
    { category: 'Mono Cartons', name: 'Cosmetics Packaging', description: 'Luxury cosmetics cartons with hot foil stamping, embossing, and premium surface finishes.', image_url: '/images/placeholder-product.svg', sort_order: 3, is_active: 1 },
    { category: 'Corrugated Solutions', name: 'Master Shipper Carton', description: 'Heavy-duty corrugated boxes, A/B/C/E flute, up to 5-ply for superior transit protection.', image_url: '/images/placeholder-product.svg', sort_order: 4, is_active: 1 },
    { category: 'Corrugated Solutions', name: 'E-Commerce Box', description: 'Right-sized e-commerce packaging with branded 2-colour direct flexo print.', image_url: '/images/placeholder-product.svg', sort_order: 5, is_active: 1 },
    { category: 'Display Boxes', name: 'PDQ Display Unit', description: 'Point-of-purchase display units engineered for retail shelf visibility and product merchandising.', image_url: '/images/placeholder-product.svg', sort_order: 6, is_active: 1 },
    { category: 'Litho Laminated', name: 'Litho Laminated Box', description: 'Premium litho print on board for high-end product presentation in retail.', image_url: '/images/placeholder-product.svg', sort_order: 7, is_active: 1 },
    { category: 'Hangtags & Labels', name: 'Custom Hangtag', description: 'Brand-differentiated hangtags for apparel and retail applications with premium finishes.', image_url: '/images/placeholder-product.svg', sort_order: 8, is_active: 1 },
    { category: 'Bellybands & Inserts', name: 'Decorative Bellyband', description: 'Functional and decorative bellybands and inserts for product presentation and protection.', image_url: '/images/placeholder-product.svg', sort_order: 9, is_active: 1 },
  ];
  products.forEach(p => {
    db._counters.products++;
    db.products.push({ id: db._counters.products, ...p, created_at: now, updated_at: now });
  });
}

// Seed default certifications
if (!db.certifications.length) {
  const now = new Date().toISOString();
  const certs = [
    { title: 'ISO Compliant', body: 'Our manufacturing processes meet international quality management standards ensuring consistent product quality.', image_url: '', badge_icon: 'fa-certificate', sort_order: 1, is_active: 1 },
    { title: 'FSC Certified', body: 'Forest Stewardship Council certified materials ensuring responsible sourcing and eco-friendly supply chain.', image_url: '', badge_icon: 'fa-leaf', sort_order: 2, is_active: 1 },
    { title: 'GMI Certified', body: 'G7 Master Qualification for colour accuracy and brand consistency across all print runs.', image_url: '', badge_icon: 'fa-award', sort_order: 3, is_active: 1 },
  ];
  certs.forEach(c => {
    db._counters.certifications++;
    db.certifications.push({ id: db._counters.certifications, ...c, created_at: now, updated_at: now });
  });
}

// Seed default capabilities
if (!db.capabilities.length) {
  const now = new Date().toISOString();
  const caps = [
    { title: 'Pre-Press & Design', description: 'ESKO suite & Artios CAD structural design, 3D rendering & photorealistic visualization, dieline development, ICC color management & preflight.', icon: 'fa-pencil-ruler', image_url: '', sort_order: 1, is_active: 1 },
    { title: 'Precision Printing', description: 'Heidelberg multicolor offset presses, GMI-compliant color management, X-Rite i1 inline monitoring, tight ΔE control, direct flexo for corrugated.', icon: 'fa-print', image_url: '', sort_order: 2, is_active: 1 },
    { title: 'Post-Press & Finishing', description: 'Flatbed die-cutting up to 52"×72", UV & blister coating, folder-gluing with inline QC, window patching, corrugation A/B/C/E flute up to 5-ply.', icon: 'fa-cut', image_url: '', sort_order: 3, is_active: 1 },
    { title: 'Quality Assurance', description: 'Multi-stage inspection, burst strength & compression testing, transit & drop simulation, ISO / BRC / FSC compliance, Six Sigma & lean manufacturing.', icon: 'fa-shield-alt', image_url: '', sort_order: 4, is_active: 1 },
  ];
  caps.forEach(c => {
    db._counters.capabilities++;
    db.capabilities.push({ id: db._counters.capabilities, ...c, created_at: now, updated_at: now });
  });
}

// Seed default settings
const defaultSettings = {
  site_logo: '',
  site_title: 'Kraftman Packaging - Premium Packaging Manufacturer India',
  site_description: 'Leading paperboard packaging manufacturer specializing in mono cartons, corrugated packaging, hangtags, and display boxes for FMCG, retail & pharma.',
  meta_keywords: 'packaging manufacturer India, mono cartons, corrugated packaging, FMCG packaging, retail packaging, pharmaceutical packaging, Haryana packaging',
  phone1: '+91-1275-262000',
  phone2: '+91-9717002464',
  phone3: '+91-9717015111',
  email: 'info@kraftmanpackaging.com',
  address: 'Khasra No 69/8/2, Baghola Janoli Link Road, Village Janoli, Palwal, Faridabad, Haryana - 121102, India',
  tagline: "Print with Precision | Pack with Pride | Deliver with Trust",
  hero_heading: "India's Trusted Packaging Partner",
  hero_subheading: 'Precision-crafted mono cartons, corrugated solutions & retail packaging for leading FMCG, pharma & consumer brands.',
  strengths_data: JSON.stringify([
    { label: 'Strength One', title: 'Quality Excellence', description: 'Die-hard determination to serve clients with utmost quality through rigorous standards and continuous improvement at every stage of production.' },
    { label: 'Strength Two', title: 'Professional Team', description: 'Qualified professionals oriented to examine the minutest details, ensuring no loose ends in manufacturing and quality assurance processes.' },
    { label: 'Strength Three', title: 'Client Trust', description: 'Our strength is derived from the immense trust clients place in us, built through consistent delivery, reliability, and transparent communication.' },
    { label: 'Strength Four', title: 'Technical Capability', description: 'Advanced manufacturing infrastructure combined with engineering expertise to deliver complex packaging solutions efficiently and at scale.' }
  ]),
  mfg_steps_data: JSON.stringify([
    { step_num: '01', icon: 'fa-pencil-ruler', title: 'Pre-Press & Design', description: 'ESKO suite & Artios CAD structural design, 3D rendering & photorealistic visualization, dieline development, ICC color management & preflight, rapid prototyping via sample maker, and Adobe Creative Suite.', features: ['ESKO Suite & Artios CAD', '3D Rendering & Visualization', 'ICC Color Management', 'Rapid Prototyping'], image_url: '/uploads/1772778589508-452603.jpg' },
    { step_num: '02', icon: 'fa-print', title: 'Precision Printing', description: 'Heidelberg multicolor offset presses, GMI-compliant color management, X-Rite i1 & PressSign inline monitoring, tight ΔE color control, and 2-color direct corrugated flexo printing.', features: ['Heidelberg Offset Presses', 'GMI-Compliant Color Mgmt', 'Tight ΔE Color Control', 'X-Rite i1 Inline Monitoring'], image_url: '/uploads/1772778913655-551648.jpg' },
    { step_num: '03', icon: 'fa-cut', title: 'Post-Press & Finishing', description: 'Flatbed die-cutting up to 52"×72", UV & blister coating, folder-gluing with inline QC, window patching, corrugation A/B/C/E flute up to 5-ply, maximum board width 1400mm.', features: ['Die-Cutting up to 52"×72"', 'UV & Blister Coating', 'A/B/C/E Flute up to 5-Ply', 'Inline QC Folder-Gluers'], image_url: '/uploads/1772778925890-506904.jpg' }
  ]),
  npd_steps_data: JSON.stringify([
    { number: '01', icon: 'fa-cube', title: 'Sample Maker', description: 'Advanced technology for rapid prototyping — quick, accurate physical prototypes with drastic reduction in manual labor and development time.' },
    { number: '02', icon: 'fa-eye', title: '3D Rendering', description: 'Seamless integration using 3D renderings as references for sample maker prototypes — virtual approval before physical production begins.' },
    { number: '03', icon: 'fa-truck', title: 'Transit Testing', description: 'Rigorous testing integrated into the development process — ensuring product safety and durability during transit before launch.' }
  ]),
  quality_items_data: JSON.stringify([
    { icon: 'fa-flask', title: 'Quality Control Laboratory', description: 'State-of-the-art testing facilities with comprehensive material testing protocols. ISO-compliant procedures for every batch.' },
    { icon: 'fa-search', title: 'Inspection Systems', description: 'Multi-stage inspection process with automated quality checks and manual verification. Real-time defect detection throughout production.' },
    { icon: 'fa-shield-alt', title: 'Compliance & Standards', description: 'ISO, BRC, and FSC adherence with regular third-party audits and fully documented Quality Management System.' },
    { icon: 'fa-vials', title: 'Testing Capabilities', description: 'Burst strength, compression, and durability testing; color consistency verification; transit and drop test simulations.' },
    { icon: 'fa-chart-line', title: 'Continuous Improvement', description: 'Six Sigma and lean manufacturing methodologies, root cause analysis, and ongoing employee training programs.' }
  ]),
  npd_video_url: '',
  strengths_bg_image: '',
  manufacturing_bg_image: '',
  products_bg_image: '',
  quality_bg_image: '',
  clients_bg_image: '',
  whyus_bg_image: '',
  certifications_bg_image: '',
  contact_bg_image: '',
  whyus_items_data: JSON.stringify([
    { icon: 'fa-cogs', title: 'Advanced Manufacturing', description: 'State-of-the-art Heidelberg presses, CTP technology, and automated finishing lines ensure precision, repeatability, and efficiency at scale.' },
    { icon: 'fa-check-double', title: 'GMI-Certified Quality', description: 'Equipped testing laboratory with rigorous multi-stage quality control at every production phase. Tight ΔE color control across long runs.' },
    { icon: 'fa-bolt', title: 'Reduced Turnaround', description: 'Sample maker + 3D rendering integration dramatically reduces development cycles. Rapid prototyping with quick physical mock-ups.' },
    { icon: 'fa-leaf', title: 'Sustainability Focus', description: 'FSC-certified materials, eco-friendly paperboard, and sustainable manufacturing practices throughout every step of production.' },
    { icon: 'fa-users', title: 'Expert Team', description: 'Qualified professionals in design, engineering, quality control, and customer service — detail-oriented at every stage.' },
    { icon: 'fa-handshake', title: 'Client Partnership', description: 'Collaborative approach with a proven track record delivering customized solutions that meet specific client requirements and brand standards.' }
  ]),
};
Object.entries(defaultSettings).forEach(([k, v]) => {
  if (db.site_settings[k] === undefined) db.site_settings[k] = v;
});

save(db);
console.log('✅ Database initialized');

/* ── ORM-LIKE HELPERS ────────────────────────────────────────────── */
const orm = {
  // Admin
  findAdmin: (username) => { db = load(); return db.admins.find(a => a.username === username); },
  findAdminById: (id) => { db = load(); return db.admins.find(a => a.id === id); },
  updateAdminPassword: (id, hash) => {
    db = load();
    const a = db.admins.find(a => a.id === id);
    if (a) a.password_hash = hash;
    save(db);
  },

  // Products
  getProducts: (onlyActive = false) => {
    db = load();
    let items = [...db.products];
    if (onlyActive) items = items.filter(p => p.is_active);
    return items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },
  getProductsByCategory: (cat) => {
    db = load();
    return db.products.filter(p => p.is_active && p.category === cat).sort((a, b) => a.sort_order - b.sort_order);
  },
  getProductCategories: () => {
    db = load();
    return [...new Set(db.products.filter(p => p.is_active).map(p => p.category))].sort();
  },
  createProduct: (data) => {
    db = load();
    db._counters.products++;
    const item = { id: db._counters.products, ...data, is_active: data.is_active !== undefined ? parseInt(data.is_active) : 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    db.products.push(item);
    save(db);
    return item;
  },
  updateProduct: (id, data) => {
    db = load();
    const idx = db.products.findIndex(p => p.id === parseInt(id));
    if (idx === -1) return null;
    db.products[idx] = { ...db.products[idx], ...data, id: parseInt(id), is_active: data.is_active !== undefined ? parseInt(data.is_active) : db.products[idx].is_active, updated_at: new Date().toISOString() };
    save(db);
    return db.products[idx];
  },
  deleteProduct: (id) => {
    db = load();
    const len = db.products.length;
    db.products = db.products.filter(p => p.id !== parseInt(id));
    save(db);
    return db.products.length < len;
  },

  // Gallery
  getGallery: (onlyActive = false, category = null) => {
    db = load();
    let items = [...db.gallery];
    if (onlyActive) items = items.filter(g => g.is_active);
    if (category) items = items.filter(g => g.category === category);
    return items.sort((a, b) => a.sort_order - b.sort_order || b.id - a.id);
  },
  createGalleryItem: (data) => {
    db = load();
    db._counters.gallery++;
    const item = { id: db._counters.gallery, ...data, is_active: 1, created_at: new Date().toISOString() };
    db.gallery.push(item);
    save(db);
    return item;
  },
  updateGalleryItem: (id, data) => {
    db = load();
    const idx = db.gallery.findIndex(g => g.id === parseInt(id));
    if (idx === -1) return null;
    db.gallery[idx] = { ...db.gallery[idx], ...data, id: parseInt(id), is_active: data.is_active !== undefined ? parseInt(data.is_active) : db.gallery[idx].is_active };
    save(db);
    return db.gallery[idx];
  },
  deleteGalleryItem: (id) => {
    db = load();
    const item = db.gallery.find(g => g.id === parseInt(id));
    db.gallery = db.gallery.filter(g => g.id !== parseInt(id));
    save(db);
    return item;
  },

  // Enquiries
  getEnquiries: () => { db = load(); return [...db.enquiries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)); },
  createEnquiry: (data) => {
    db = load();
    db._counters.enquiries++;
    const item = { id: db._counters.enquiries, ...data, status: 'new', created_at: new Date().toISOString() };
    db.enquiries.push(item);
    save(db);
    return item;
  },
  updateEnquiryStatus: (id, status) => {
    db = load();
    const e = db.enquiries.find(e => e.id === parseInt(id));
    if (e) e.status = status;
    save(db);
    return e;
  },
  deleteEnquiry: (id) => {
    db = load();
    db.enquiries = db.enquiries.filter(e => e.id !== parseInt(id));
    save(db);
  },

  // Settings
  getSettings: () => { db = load(); return { ...defaultSettings, ...db.site_settings }; },
  updateSettings: (data) => {
    db = load();
    db.site_settings = { ...db.site_settings, ...data };
    save(db);
  },

  // Testimonials
  getTestimonials: () => { db = load(); return db.testimonials.filter(t => t.is_active); },

  // Clients
  getClients: (onlyActive = false) => {
    db = load();
    let items = [...db.clients];
    if (onlyActive) items = items.filter(c => c.is_active);
    return items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },
  createClient: (data) => {
    db = load();
    db._counters.clients++;
    const item = { id: db._counters.clients, ...data, is_active: data.is_active !== undefined ? parseInt(data.is_active) : 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    db.clients.push(item);
    save(db);
    return item;
  },
  updateClient: (id, data) => {
    db = load();
    const idx = db.clients.findIndex(c => c.id === parseInt(id));
    if (idx === -1) return null;
    db.clients[idx] = { ...db.clients[idx], ...data, id: parseInt(id), is_active: data.is_active !== undefined ? parseInt(data.is_active) : db.clients[idx].is_active, updated_at: new Date().toISOString() };
    save(db);
    return db.clients[idx];
  },
  deleteClient: (id) => {
    db = load();
    const item = db.clients.find(c => c.id === parseInt(id));
    db.clients = db.clients.filter(c => c.id !== parseInt(id));
    save(db);
    return item;
  },

  // Certifications
  getCertifications: (onlyActive = false) => {
    db = load();
    let items = [...db.certifications];
    if (onlyActive) items = items.filter(c => c.is_active);
    return items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },
  createCertification: (data) => {
    db = load();
    db._counters.certifications++;
    const item = { id: db._counters.certifications, ...data, is_active: data.is_active !== undefined ? parseInt(data.is_active) : 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    db.certifications.push(item);
    save(db);
    return item;
  },
  updateCertification: (id, data) => {
    db = load();
    const idx = db.certifications.findIndex(c => c.id === parseInt(id));
    if (idx === -1) return null;
    db.certifications[idx] = { ...db.certifications[idx], ...data, id: parseInt(id), is_active: data.is_active !== undefined ? parseInt(data.is_active) : db.certifications[idx].is_active, updated_at: new Date().toISOString() };
    save(db);
    return db.certifications[idx];
  },
  deleteCertification: (id) => {
    db = load();
    const item = db.certifications.find(c => c.id === parseInt(id));
    db.certifications = db.certifications.filter(c => c.id !== parseInt(id));
    save(db);
    return item;
  },

  // Capabilities
  getCapabilities: (onlyActive = false) => {
    db = load();
    let items = [...db.capabilities];
    if (onlyActive) items = items.filter(c => c.is_active);
    return items.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  },
  createCapability: (data) => {
    db = load();
    db._counters.capabilities++;
    const item = { id: db._counters.capabilities, ...data, is_active: data.is_active !== undefined ? parseInt(data.is_active) : 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    db.capabilities.push(item);
    save(db);
    return item;
  },
  updateCapability: (id, data) => {
    db = load();
    const idx = db.capabilities.findIndex(c => c.id === parseInt(id));
    if (idx === -1) return null;
    db.capabilities[idx] = { ...db.capabilities[idx], ...data, id: parseInt(id), is_active: data.is_active !== undefined ? parseInt(data.is_active) : db.capabilities[idx].is_active, updated_at: new Date().toISOString() };
    save(db);
    return db.capabilities[idx];
  },
  deleteCapability: (id) => {
    db = load();
    const item = db.capabilities.find(c => c.id === parseInt(id));
    db.capabilities = db.capabilities.filter(c => c.id !== parseInt(id));
    save(db);
    return item;
  },

  // Stats
  getStats: () => {
    db = load();
    const enquiries = db.enquiries;
    return {
      products:         db.products.filter(p => p.is_active).length,
      gallery:          db.gallery.filter(g => g.is_active).length,
      clients:          db.clients.filter(c => c.is_active).length,
      certifications:   db.certifications.filter(c => c.is_active).length,
      enquiries_total:  enquiries.length,
      enquiries_new:    enquiries.filter(e => e.status === 'new').length,
      recent_enquiries: [...enquiries].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5),
    };
  },
};

module.exports = orm;
