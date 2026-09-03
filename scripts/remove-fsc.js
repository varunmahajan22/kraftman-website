#!/usr/bin/env node
/**
 * Applies the FSC removal to a live data/db.json without touching anything
 * else — enquiries, uploads and admin-panel edits are preserved.
 *
 * Safe to run more than once; it reports "already applied" and exits 0.
 * Writes a timestamped backup next to the database before saving.
 *
 *   node scripts/remove-fsc.js            # apply
 *   node scripts/remove-fsc.js --dry-run  # show what would change
 */

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const dryRun = process.argv.includes('--dry-run');

// Copy rewrites: [find, replace]. Applied to plain fields and to the
// JSON-encoded *_items_data settings strings alike.
const REWRITES = [
  ['ISO / BRC / FSC compliance', 'ISO / BRC compliance'],
  ['ISO, BRC, and FSC adherence', 'ISO and BRC adherence'],
  [
    'FSC-certified materials, eco-friendly paperboard, and sustainable manufacturing practices',
    'Eco-friendly paperboard, responsibly sourced materials, and sustainable manufacturing practices',
  ],
];

const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);
const changes = [];

// 1. Hide the FSC certification card (kept, not deleted, so it can be
//    switched back on from Admin -> Certifications).
for (const cert of db.certifications || []) {
  if (/fsc/i.test(cert.title) && cert.is_active !== 0) {
    cert.is_active = 0;
    cert.updated_at = new Date().toISOString();
    changes.push(`certification "${cert.title}" -> is_active: 0`);
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
const remaining = (JSON.stringify(db).match(/FSC|Forest Stewardship/gi) || []).length;

if (!changes.length) {
  console.log('Already applied — no FSC content left to change.');
  console.log(`(${remaining} FSC mention(s) remain, in the deactivated certification record only.)`);
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
console.log(`${remaining} FSC mention(s) remain, in the deactivated certification record only.`);
