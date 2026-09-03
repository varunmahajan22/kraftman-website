#!/usr/bin/env node
/**
 * Hides or restores the FSC content in a live data/db.json without touching
 * anything else — enquiries, uploads and admin-panel edits are preserved.
 *
 * FSC is being withheld for 20 days from 2026-09-03, so this runs in both
 * directions. Nothing is ever deleted: the certification record is only
 * flipped between is_active 0 and 1.
 *
 * Safe to run more than once; it reports "already applied" and exits 0.
 * Writes a timestamped backup next to the database before saving.
 *
 *   node scripts/toggle-fsc.js off             # hide FSC   (deploy now)
 *   node scripts/toggle-fsc.js on              # restore FSC (~2026-09-23)
 *   node scripts/toggle-fsc.js off --dry-run   # preview, write nothing
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const mode = args.find(a => a === 'on' || a === 'off');

if (!mode) {
  console.error('Usage: node scripts/toggle-fsc.js <on|off> [--dry-run]');
  process.exit(1);
}

// Copy pairs as [withFSC, withoutFSC]. Applied to plain fields and to the
// JSON-encoded *_items_data settings strings alike.
const COPY = [
  ['ISO / BRC / FSC compliance', 'ISO / BRC compliance'],
  ['ISO, BRC, and FSC adherence', 'ISO and BRC adherence'],
  [
    'FSC-certified materials, eco-friendly paperboard, and sustainable manufacturing practices',
    'Eco-friendly paperboard, responsibly sourced materials, and sustainable manufacturing practices',
  ],
];

const hiding = mode === 'off';
// When hiding, rewrite withFSC -> withoutFSC; when restoring, the reverse.
const REWRITES = COPY.map(([withFsc, withoutFsc]) =>
  hiding ? [withFsc, withoutFsc] : [withoutFsc, withFsc]
);
const targetActive = hiding ? 0 : 1;

const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);
const changes = [];

// 1. Show or hide the FSC certification card. The record itself is kept
//    either way, so this stays reversible from Admin -> Certifications too.
for (const cert of db.certifications || []) {
  if (/fsc/i.test(cert.title) && cert.is_active !== targetActive) {
    cert.is_active = targetActive;
    cert.updated_at = new Date().toISOString();
    changes.push(`certification "${cert.title}" -> is_active: ${targetActive}`);
  }
}

// 2. Copy rewrites across capabilities and site settings.
const rewrite = (value, label) => {
  if (typeof value !== 'string') return value;
  let out = value;
  for (const [find, replace] of REWRITES) {
    if (out.includes(find)) {
      out = out.split(find).join(replace);
      changes.push(`${label}: "${find}" -> "${replace}"`);
    }
  }
  return out;
};

for (const cap of db.capabilities || []) {
  cap.description = rewrite(cap.description, `capability "${cap.title}"`);
}

for (const [key, value] of Object.entries(db.site_settings || {})) {
  db.site_settings[key] = rewrite(value, `site_settings.${key}`);
}

// 3. Report and save.
const verb = hiding ? 'hidden' : 'restored';

if (!changes.length) {
  console.log(`Already applied — FSC content is already ${verb}.`);
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
console.log(`Saved ${DB_PATH} — FSC content ${verb}.`);
console.log('Restart the app to serve the change: pm2 restart kraftman-website');
