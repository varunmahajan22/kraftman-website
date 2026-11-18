/**
 * Uploaded photographs that always fit their slot.
 *
 * Every slot has a shape. A "cover" slot is filled edge to edge: the picture is
 * scaled until it covers the slot and the overhang is cut off, centred on a
 * focus point. With no focus point sharp chooses the most eye-catching part.
 * A "contain" slot (logos) shows the whole picture on white and never cuts.
 *
 * The file as uploaded is kept in public/uploads/originals/, so a picture can
 * be cut again around a different focus point without losing quality.
 *
 * An image is recorded as { url, original, focus, slot }.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const UPLOADS = path.join(__dirname, '..', 'public', 'uploads');
const ORIGINALS = path.join(UPLOADS, 'originals');
if (!fs.existsSync(ORIGINALS)) fs.mkdirSync(ORIGINALS, { recursive: true });

const SLOTS = {
  product: { width: 1200, height: 900, fit: 'cover' },     // gallery photos and family photos, 4:3
  page:    { width: 1600, height: 1200, fit: 'cover' },    // the photo in a page's header, 4:3
  logo:    { width: 400, height: 200, fit: 'contain' },
  cert:    { width: 400, height: 400, fit: 'contain' },
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Cut `original` (a path under ORIGINALS) for a slot. Returns the record to store.
async function cut(originalName, slotName, focus) {
  const slot = SLOTS[slotName] || SLOTS.product, source = path.join(ORIGINALS, path.basename(originalName));
  // Turn the picture upright first, so the sizes below are the ones people see.
  const upright = await sharp(source, { density: 200 }).rotate().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = upright.info;
  let img = sharp(upright.data);
  if (slot.fit === 'contain') {
    img = img.resize({ width: slot.width, height: slot.height, fit: 'contain', background: '#ffffff' });
  } else if (focus) {
    // The largest slot-shaped window that fits the picture, centred on the focus point and kept inside the edges.
    const k = Math.min(w / slot.width, h / slot.height), cw = Math.round(slot.width * k), ch = Math.round(slot.height * k);
    const left = clamp(Math.round(focus[0] * w - cw / 2), 0, w - cw), top = clamp(Math.round(focus[1] * h - ch / 2), 0, h - ch);
    img = img.extract({ left, top, width: cw, height: ch }).resize({ width: slot.width, height: slot.height, fit: 'fill' });
  } else {
    img = img.resize({ width: slot.width, height: slot.height, fit: 'cover', position: sharp.strategy.attention });
  }
  // A new name for every cut, so a browser never shows the old one from its cache.
  const base = path.basename(originalName, path.extname(originalName)), name = base + '-' + Date.now().toString(36) + '.jpg';
  await img.flatten({ background: '#ffffff' }).jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(UPLOADS, name));
  return { url: '/uploads/' + name, original: '/uploads/originals/' + path.basename(originalName), focus: focus ? [focus[0], focus[1]] : null, slot: slotName };
}

// Take a file multer has just saved in public/uploads, keep it as the original, and cut it for its slot.
async function accept(file, slotName) {
  const kept = path.join(ORIGINALS, file.filename);
  fs.renameSync(file.path, kept);
  try { return await cut(file.filename, slotName, null); }
  catch (err) { fs.unlinkSync(kept); throw new Error('That file could not be read as a picture.'); }
}

// Cut an image again around a new focus point, removing the previous cut.
async function recut(record, focus) {
  if (!record || !record.original) throw new Error('The original of this picture is not on the server, so it cannot be cropped again. Upload it once more.');
  const fresh = await cut(path.basename(record.original), record.slot, [clamp(+focus[0] || 0, 0, 1), clamp(+focus[1] || 0, 0, 1)]);
  remove({ url: record.url });
  return fresh;
}

// Delete an image's files. Pass only the url to keep the original.
function remove(record) {
  [record && record.url, record && record.original].filter(Boolean).forEach(url => {
    const file = path.join(UPLOADS, url.replace(/^\/uploads\//, ''));
    if (file.indexOf(UPLOADS) === 0 && fs.existsSync(file)) fs.unlinkSync(file);
  });
}

module.exports = { SLOTS, UPLOADS, ORIGINALS, accept, recut, remove };
