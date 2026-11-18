#!/usr/bin/env node
/**
 * Tidies the product photo galleries in a live data/db.json after the old
 * product list was brought across:
 *   - corrects "Bilister" to "Blister";
 *   - moves photos that landed in the wrong product family (rigid and canister
 *     boxes to Rigid boxes, the blister/insert card to Backer cards);
 *   - replaces the old sales wording in captions with a plain name.
 * A family that gains its first photo this way also takes it as its main photo.
 *
 * Safe to run more than once. Writes a timestamped backup before saving.
 *
 *   node scripts/tidy-gallery.js            # apply
 *   node scripts/tidy-gallery.js --dry-run  # preview, write nothing
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const dryRun = process.argv.includes('--dry-run');

// A photo whose caption starts with `was` belongs in `family` and is captioned `caption`.
const RULES = [
  { was: /^retail mono carton/i, family: 'printed-mono-cartons', caption: 'Retail mono carton' },
  { was: /^pharmaceutical carton/i, family: 'printed-mono-cartons', caption: 'Pharmaceutical carton' },
  { was: /^litho.?laminated box/i, family: 'corrugated-boxes', caption: 'Litho-laminated box' },
  { was: /^master shipper/i, family: 'corrugated-boxes', caption: 'Master shipper carton' },
  { was: /^e-?commerce box/i, family: 'corrugated-boxes', caption: 'E-commerce box' },
  { was: /^rigid box/i, family: 'rigid-boxes', caption: 'Rigid box' },
  { was: /^canister box/i, family: 'rigid-boxes', caption: 'Canister box' },
  { was: /^display box/i, family: 'retail-display-packaging', caption: 'Display box' },
  { was: /^pdq display/i, family: 'retail-display-packaging', caption: 'PDQ display unit' },
  { was: /^b(i|)lister/i, family: 'backer-cards', caption: 'Blister, insert, header, U and J cards' },
  { was: /^paper hanger/i, family: 'hang-tags', caption: 'Paper hanger' },
  { was: /^custom hangtag/i, family: 'hang-tags', caption: 'Custom hangtag' },
  { was: /^decorative bellyband/i, family: 'hang-tags', caption: 'Bellyband' },
];

const raw = fs.readFileSync(DB_PATH, 'utf8');
const db = JSON.parse(raw);
const families = db.families || {};
const changes = [];

Object.keys(families).filter(slug => slug !== '_migrated').forEach(slug => {
  (families[slug].gallery || []).slice().forEach(item => {
    const rule = RULES.find(r => r.was.test(item.caption || ''));
    if (!rule) return;
    if (item.caption !== rule.caption) { changes.push(`caption "${item.caption.slice(0, 40)}" -> "${rule.caption}"`); item.caption = rule.caption; }
    if (rule.family !== slug) {
      const to = families[rule.family] = families[rule.family] || { photo: null, gallery: [] };
      to.gallery = to.gallery || [];
      families[slug].gallery = families[slug].gallery.filter(g => g !== item);
      item.sort = to.gallery.length + 1;
      to.gallery.push(item);
      if (!to.photo && item.image) to.photo = item.image;
      changes.push(`moved "${rule.caption}" from ${slug} to ${rule.family}`);
    }
  });
});

if (!changes.length) { console.log('Nothing to tidy: the galleries are already in order.'); process.exit(0); }
console.log(changes.length + ' change(s):\n' + changes.map(c => '  - ' + c).join('\n'));
if (dryRun) { console.log('\nDry run: nothing written.'); process.exit(0); }
const backup = DB_PATH + '.bak-' + Date.now();
fs.writeFileSync(backup, raw);
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('\nBackup written to ' + backup + '\nSaved ' + DB_PATH);
