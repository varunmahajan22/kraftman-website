/**
 * imageResize.js — Auto-scaling middleware for Kraftman Packaging
 *
 * Resize specs per upload type:
 *  product  → 800×600 px (4:3)   | fit inside | white bg  | JPEG 85%
 *  gallery  → max 1600×1200 px  | fit inside  | JPEG 82%
 *  logo     → max 400×200 px    | fit inside  | white bg  | JPEG 85%
 *  cert     → max 800×1100 px   | fit inside  | white bg  | JPEG 85%
 *  general  → max 1600×1200 px  | fit inside  | JPEG 82%
 *
 * Output is always saved as JPEG (.jpg) to save disk space.
 * Original file is overwritten; filename extension updated if needed.
 */

const sharp  = require('sharp');
const path   = require('path');
const fs     = require('fs');

const PRESETS = {
  product: { width:  800, height:  600, fit: 'inside',     bg: '#FFFFFF', quality: 85 },
  gallery: { width: 1600, height: 1200, fit: 'inside',     bg: null,      quality: 82 },
  logo:    { width:  400, height:  200, fit: 'inside',     bg: '#FFFFFF', quality: 85 },
  cert:    { width:  800, height: 1100, fit: 'inside',     bg: '#FFFFFF', quality: 85 },
  general: { width: 1600, height: 1200, fit: 'inside',     bg: null,      quality: 82 },
};

/**
 * Resize a single file in-place.
 * @param {string} filePath  Absolute path to the uploaded file.
 * @param {string} type      One of: product | gallery | logo | cert | general
 * @returns {Promise<string>} Final file path (may have .jpg extension)
 */
async function resizeImage(filePath, type = 'general') {
  const preset  = PRESETS[type] || PRESETS.general;
  const ext     = path.extname(filePath).toLowerCase();

  // SVG files cannot be rasterized by sharp — serve as-is
  if (ext === '.svg') return filePath;

  const outPath = filePath.replace(/\.[^.]+$/, '.jpg');  // always output .jpg

  const pipeline = sharp(filePath)
    .rotate()                                   // auto-correct EXIF orientation
    .resize({
      width:    preset.width,
      height:   preset.height,
      fit:      preset.fit,
    });

  // Add white background for formats that may have transparency
  if (preset.bg) {
    pipeline.flatten({ background: preset.bg });
  }

  await pipeline.jpeg({ quality: preset.quality, mozjpeg: true }).toFile(outPath + '.tmp');

  // Atomic replace: tmp → final, remove original if extension changed
  fs.renameSync(outPath + '.tmp', outPath);
  if (outPath !== filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return outPath;
}

/**
 * Express middleware factory.
 * Usage: router.post('/products', upload.single('image'), imageResizeMiddleware('product'), handler)
 *
 * Attaches req.resizedFile = { filename, url, size } if a file was uploaded.
 */
function imageResizeMiddleware(type = 'general') {
  return async (req, res, next) => {
    // support both single file (req.file) and multiple files (req.files array)
    const files = req.file ? [req.file] : (Array.isArray(req.files) ? req.files : []);
    if (!files.length) return next();

    try {
      for (const file of files) {
        const finalPath = await resizeImage(file.path, type);
        const newFilename = path.basename(finalPath);

        // Patch multer file object so route handlers get correct values
        file.path     = finalPath;
        file.filename = newFilename;
        file.size     = fs.statSync(finalPath).size;
      }
      next();
    } catch (err) {
      console.error('[imageResize] Error:', err.message);
      next(err);
    }
  };
}

module.exports = { resizeImage, imageResizeMiddleware };
