#!/usr/bin/env node
/**
 * Sets the certifications and audits Kraftman Packaging holds — GMI, FSC, ISO,
 * Sedex and SMETA — in a live data/db.json, with accurate plain-language
 * descriptions. Existing records are matched by name and updated in place, so
 * their uploaded logos are kept; missing ones are added. Nothing else in the
 * database is touched.
 *
 * Safe to run more than once. Writes a timestamped backup before saving.
 *
 *   node scripts/update-certifications.js            # apply
 *   node scripts/update-certifications.js --dry-run  # preview, write nothing
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const dryRun = process.argv.includes('--dry-run');

const WANTED = [
  {
    match: /gmi/i, title: 'GMI Certified', badge_icon: 'fa-award',
    body: 'Certified by GMI (Graphic Measures International), which audits packaging printers for retail and brand packaging programmes. It covers print quality, colour consistency and process control.',
  },
  {
    match: /fsc/i, title: 'FSC Certified', badge_icon: 'fa-leaf',
    body: 'Forest Stewardship Council chain-of-custody certification. The paper and board in FSC-labelled packaging can be traced to responsibly managed forests and other controlled sources.',
  },
  {
    match: /^iso\b/i, title: 'ISO Certified', badge_icon: 'fa-certificate',
    body: 'Our management system is certified to ISO standards by an independent certification body.',
  },
  {
    match: /sedex/i, title: 'Sedex Member', badge_icon: 'fa-handshake',
    body: 'A member of Sedex, the platform on which suppliers share ethical and responsible sourcing information with their customers.',
  },
  {
    match: /smeta/i, title: 'SMETA Audited', badge_icon: 'fa-clipboard-check',
    body: 'Audited under SMETA, the Sedex Members Ethical Trade Audit: an on-site social audit covering labour standards and health and safety.',
  },
];

const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);
db.certifications = db.certifications || [];
db._counters = db._counters || {};
const changes = [];
const now = new Date().toISOString();

WANTED.forEach((want, i) => {
  const fields = { title: want.title, body: want.body, sort_order: i + 1, is_active: 1 };
  let cert = db.certifications.find(c => want.match.test(c.title));
  if (!cert) {
    db._counters.certifications = (db._counters.certifications || 0) + 1;
    cert = { id: db._counters.certifications, image_url: '', badge_icon: want.badge_icon, created_at: now };
    db.certifications.push(cert);
    changes.push(`added "${want.title}"`);
  }
  const before = JSON.stringify(Object.keys(fields).map(k => cert[k]));
  Object.assign(cert, fields);
  if (before !== JSON.stringify(Object.keys(fields).map(k => cert[k]))) {
    cert.updated_at = now;
    if (!changes.includes(`added "${want.title}"`)) changes.push(`updated "${want.title}"`);
  }
});

if (!changes.length) {
  console.log('Already applied — the four certifications are up to date.');
  process.exit(0);
}

console.log(`${changes.length} change(s):`);
changes.forEach(c => console.log(`  - ${c}`));

if (dryRun) {
  console.log('\nDry run — nothing written.');
  process.exit(0);
}

const backup = `${DB_PATH}.bak-${Date.now()}`;
fs.writeFileSync(backup, raw);
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`\nBackup written to ${backup}`);
console.log(`Saved ${DB_PATH}`);
console.log('SMETA has no logo yet: add one under Admin -> Certifications if you want it shown.');
