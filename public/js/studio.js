/* ═══════════════════════════════════════════════════════════════════
   Box Studio — the app (Three.js r128)

   One `state` object describes the customer's design. Two things are
   derived from it:

     • the model — rebuilt from StudioBoxes whenever size, style or an
       option changes;
     • each face's surface — three canvases composited from the base
       colour, the artwork and the finish elements:
         colour     what is printed, plus foil laid over it
         gloss      roughness (green) and metalness (blue): the coating,
                    with spot UV and foil cut into it
         relief     height, for embossing and debossing
       They feed one physically based material per face, lit by a studio
       environment so foil and gloss have something to reflect.

   Artwork (PDF, PNG, JPG or SVG) is read and placed in the browser and
   never leaves it; only the written spec is sent. Placement is automatic:
   a sheet is recognised by its proportions as one face, a wrap round the
   four sides or a flat carton layout, and text and logos are set clear of
   the window, hang hole, lid seam and ribbon pull. Every choice can be
   overridden by hand.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const P = window.StudioPalette, B = window.StudioBoxes;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const canvas = $('stCanvas'), view = $('stView');
  let renderer = null;
  if (window.THREE) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
    catch (e) { renderer = null; }
  }
  if (!renderer) { document.documentElement.classList.add('st-no3d'); }

  /* ── STATE ───────────────────────────────────────────────────────── */
  const FACE_IDS = ['front', 'back', 'left', 'right', 'top', 'bottom'];
  const FONTS = [['Montserrat', 700], ['Playfair Display', 600], ['Inter', 600], ['Lexend Exa', 400]];
  const state = {
    type: 'carton', L: 120, W: 60, H: 180,
    open: 0, lid: 35, lip: 30, hole: 'slot', product: true,
    window: { on: false, shape: 'rounded', w: 56, h: 42, x: 50, y: 56 },
    colour: P.SPOT_COLOURS.find(c => c.name === 'PANTONE 289 C'),
    inside: P.STOCKS[0], coating: 'matt-lam',
    faces: {}, face: 'front',
  };
  FACE_IDS.forEach(id => { state.faces[id] = { art: null, fit: 'cover', scale: 100, els: [] }; });
  let nextId = 1;

  const type = () => B.byId(state.type);
  // The current design in the scene's units (1 unit = 100 mm).
  const dims = () => ({
    L: state.L / 100, W: Math.max(state.W, 1) / 100, H: state.H / 100,
    open: state.open, lid: state.lid, lip: state.lip, hole: state.hole, product: state.product, window: state.window,
  });
  const faceList = () => type().faces(dims());

  /* ── SCENE ───────────────────────────────────────────────────────── */
  const RES = 1024;                  // longest side of a face texture, in pixels
  let scene, camera, model = null, dirty = true;
  let flat = null;                   // the flat layout beside the 3D view (studio-flat.js)
  const surfaces = {};               // per face: { colour, gloss, relief canvases; textures; front and rear materials }
  const mat = {};
  const orbit = { az: 0.62, pol: 1.18, zoom: 1, radius: 2, target: null, idle: 0 };

  function studioLight() {
    // A plain photo studio, painted: mid-grey walls with a few bright light panels
    // and dark gaps, so foil and gloss show a moving reflection. The walls are kept
    // grey, not white: a white room lays a pale veil over dark spot colours.
    // The ambient light below makes up the brightness.
    const cv = document.createElement('canvas');
    cv.width = 1024; cv.height = 512;
    const c = cv.getContext('2d');
    const sky = c.createLinearGradient(0, 0, 0, 512);
    sky.addColorStop(0, '#d8dce1'); sky.addColorStop(0.46, '#cfd4d9'); sky.addColorStop(0.56, '#b0b6bd'); sky.addColorStop(1, '#8e949c');
    c.fillStyle = sky; c.fillRect(0, 0, 1024, 512);
    c.filter = 'blur(12px)';
    c.fillStyle = '#ffffff';
    [[70, 50, 230, 120], [420, 30, 170, 150], [760, 60, 210, 110]].forEach(r => c.fillRect(r[0], r[1], r[2], r[3]));
    c.fillStyle = '#3a4048';
    [[320, 80, 70, 130], [640, 70, 60, 140], [20, 90, 30, 110]].forEach(r => c.fillRect(r[0], r[1], r[2], r[3]));
    const tex = new THREE.CanvasTexture(cv);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.encoding = THREE.sRGBEncoding;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose(); tex.dispose();
    return env;
  }

  function initScene() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    scene = new THREE.Scene();
    scene.environment = studioLight();
    camera = new THREE.PerspectiveCamera(32, 1, 0.05, 200);
    orbit.target = new THREE.Vector3();

    const key = new THREE.DirectionalLight(0xffffff, 0.3);
    key.position.set(-4, 9, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = key.shadow.camera;
    s.left = -9; s.right = 9; s.top = 9; s.bottom = -9; s.near = 1; s.far = 40;
    s.updateProjectionMatrix();
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    scene.add(key);
    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.18 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.002;
    ground.receiveShadow = true;
    scene.add(ground);

    const plain = (hex, rough, extra) => new THREE.MeshStandardMaterial(Object.assign({ color: new THREE.Color(hex).convertSRGBToLinear(), roughness: rough }, extra || {}));
    mat.inside = plain(state.inside.hex, 0.85);
    mat.insideBack = plain(state.inside.hex, 0.85, { side: THREE.DoubleSide });
    mat.accent = plain('#C9A24B', 0.6);
    mat.film = plain('#ffffff', 0.04, { transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 2.2 });
    mat.product = plain('#c7d4e0', 0.3);
    mat.cap = plain('#2b3340', 0.4);
    mat.ribbon = plain('#C9A24B', 0.5);

    const aniso = renderer.capabilities.getMaxAnisotropy();
    FACE_IDS.forEach(id => {
      const layer = encoding => {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 4;
        const tex = new THREE.CanvasTexture(cv);
        tex.anisotropy = aniso;
        if (encoding) tex.encoding = encoding;
        return { cv, tex };
      };
      const colour = layer(THREE.sRGBEncoding), gloss = layer(), relief = layer();
      // roughness and metalness are 1 so the gloss texture alone decides them.
      const settings = { map: colour.tex, roughnessMap: gloss.tex, metalnessMap: gloss.tex, bumpMap: relief.tex, bumpScale: 0.04, roughness: 1, metalness: 1 };
      surfaces[id] = {
        colour, gloss, relief,
        front: new THREE.MeshStandardMaterial(settings),
        rear: new THREE.MeshStandardMaterial(Object.assign({ side: THREE.BackSide }, settings)),
      };
    });
  }

  // What the models are built from.
  const ctx = {
    face: id => surfaces[id].front,
    faceBack: id => surfaces[id].rear,
    get inside() { return mat.inside; }, get insideBack() { return mat.insideBack; },
    get accent() { return mat.accent; }, get film() { return mat.film; },
    get product() { return mat.product; }, get cap() { return mat.cap; }, get ribbon() { return mat.ribbon; },
  };

  /* ── FACE SURFACES ───────────────────────────────────────────────── */
  const finish = id => P.FINISHES.find(f => f.id === id);
  const channel = v => Math.round(clamp(v, 0, 1) * 255);
  const glossInk = (rough, metal) => 'rgb(0,' + channel(rough) + ',' + channel(metal) + ')';

  // An uploaded logo as a stencil: its own transparency if it has any,
  // otherwise its darkness (black artwork on white becomes the shape).
  function stencil(img, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const c = cv.getContext('2d');
    c.drawImage(img, 0, 0, w, h);
    const data = c.getImageData(0, 0, w, h), px = data.data;
    let hasAlpha = false;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 250) { hasAlpha = true; break; }
    for (let i = 0; i < px.length; i += 4) {
      const a = hasAlpha ? px[i + 3] : 255 - (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]);
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = a;
    }
    c.putImageData(data, 0, 0);
    return cv;
  }
  function tinted(mask, ink) {
    const cv = document.createElement('canvas');
    cv.width = mask.width; cv.height = mask.height;
    const c = cv.getContext('2d');
    c.drawImage(mask, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = ink;
    c.fillRect(0, 0, cv.width, cv.height);
    return cv;
  }

  // Draw one element onto a layer. `ink` paints its shape in a flat colour;
  // without it the element is drawn as itself (text in its colour, a logo as uploaded).
  function stamp(c, el, cw, ch, ink, soften) {
    const w = el.size / 100 * cw, cx = el.x / 100 * cw, cy = (1 - el.y / 100) * ch;
    c.save();
    if (soften) c.filter = 'blur(' + soften + 'px)';
    if (el.kind === 'text') {
      c.font = el.weight + ' 200px "' + el.font + '"';
      const k = w / Math.max(c.measureText(el.text || ' ').width, 1);
      c.translate(cx, cy);
      c.scale(k, k);
      if (soften) c.filter = 'blur(' + soften / k + 'px)';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = ink || el.colour;
      c.fillText(el.text, 0, 0);
    } else {
      const h = w * el.mask.height / el.mask.width;
      c.drawImage(ink ? tinted(el.mask, ink) : el.img, cx - w / 2, cy - h / 2, w, h);
    }
    c.restore();
  }

  function compose(id) {
    const entry = faceList().find(f => f[0] === id);
    if (!entry) return;
    const [fw, fh] = entry[2], face = state.faces[id], s = surfaces[id];
    const cw = fw >= fh ? RES : Math.max(48, Math.round(RES * fw / fh));
    const ch = fw >= fh ? Math.max(48, Math.round(RES * fh / fw)) : RES;
    [s.colour, s.gloss, s.relief].forEach(l => { l.cv.width = cw; l.cv.height = ch; });
    const col = s.colour.cv.getContext('2d'), gl = s.gloss.cv.getContext('2d'), rel = s.relief.cv.getContext('2d');

    col.fillStyle = state.colour.hex; col.fillRect(0, 0, cw, ch);
    gl.fillStyle = glossInk(P.COATINGS.find(k => k.id === state.coating).roughness, 0); gl.fillRect(0, 0, cw, ch);
    rel.fillStyle = '#808080'; rel.fillRect(0, 0, cw, ch);

    if (face.art) {
      const img = face.art.img, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
      const k = (face.fit === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih)) * face.scale / 100;
      col.drawImage(img, (cw - iw * k) / 2, (ch - ih * k) / 2, iw * k, ih * k);
    }
    face.els.forEach(el => {
      const f = finish(el.finish);
      if (f.id === 'print') stamp(col, el, cw, ch);
      if (f.colour) stamp(col, el, cw, ch, f.colour);                              // foil lays its own colour down
      if (f.rough !== undefined) stamp(gl, el, cw, ch, glossInk(f.rough, f.metal || 0));
      const relief = f.relief || (el.raised ? 1 : 0);
      if (relief) stamp(rel, el, cw, ch, relief > 0 ? '#ffffff' : '#000000', 2.5);
    });
    [s.colour, s.gloss, s.relief].forEach(l => { l.tex.needsUpdate = true; });
    dirty = true;
    if (flat) flat.redraw();
  }
  const composeAll = () => faceList().forEach(f => compose(f[0]));

  /* ── ARTWORK FILES ───────────────────────────────────────────────── */
  // Images are read through an <img>, PDFs through pdf.js, which is fetched
  // only when a PDF is chosen. Either way the result is `source.page(n)`,
  // resolving to a canvas, and nothing is uploaded anywhere.
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const ART_PX = 2400;               // longest side a page of artwork is rasterised to
  let pdfLib = null;
  function loadPdfLib() {
    if (!pdfLib) {
      pdfLib = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = PDFJS + 'pdf.min.js';
        s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js'; resolve(window.pdfjsLib); };
        s.onerror = () => { pdfLib = null; reject(new Error('The PDF reader could not be loaded. Check your connection and try again.')); };
        document.head.appendChild(s);
      });
    }
    return pdfLib;
  }
  const blankCanvas = (w, h) => {
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
    return cv;
  };

  function openArtwork(file) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      return Promise.all([loadPdfLib(), file.arrayBuffer()])
        .then(([lib, data]) => lib.getDocument({ data, isEvalSupported: false }).promise)
        .then(doc => ({
          name: file.name, pages: doc.numPages,
          page: n => doc.getPage(n).then(pg => {
            const base = pg.getViewport({ scale: 1 });
            const vp = pg.getViewport({ scale: Math.min(ART_PX / Math.max(base.width, base.height), 6) });
            const cv = blankCanvas(vp.width, vp.height);
            return pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise.then(() => cv);
          }),
        }), () => { throw new Error('That PDF could not be opened. If it is password protected, save an unprotected copy.'); });
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('That file could not be read.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('We could not show that file. Use a PDF, PNG, JPG or SVG.'));
        img.onload = () => {
          const iw = img.naturalWidth || 1024, ih = img.naturalHeight || 1024, k = Math.min(1, ART_PX / Math.max(iw, ih));
          const cv = blankCanvas(iw * k, ih * k);
          cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          resolve({ name: file.name, pages: 1, page: () => Promise.resolve(cv) });
        };
        img.src = reader.result;                  // a data: URL, so the picture stays on this device
      };
      reader.readAsDataURL(file);
    });
  }

  // Cut blank page margins away, so that centring centres the artwork and not the sheet.
  function trim(cv) {
    try {
      const k = Math.min(1, 320 / Math.max(cv.width, cv.height));
      const small = blankCanvas(cv.width * k, cv.height * k), w = small.width, h = small.height;
      const c = small.getContext('2d');
      c.drawImage(cv, 0, 0, w, h);
      const px = c.getImageData(0, 0, w, h).data;
      const blank = (x, y) => { const i = (y * w + x) * 4; return px[i + 3] < 16 || (px[i] > 240 && px[i + 1] > 240 && px[i + 2] > 240); };
      if (!(blank(0, 0) && blank(w - 1, 0) && blank(0, h - 1) && blank(w - 1, h - 1))) return cv;
      let x0 = w, y0 = h, x1 = -1, y1 = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (blank(x, y)) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
      if (x1 < 0) return cv;
      const sx = Math.max(0, (x0 - 1) / k), sy = Math.max(0, (y0 - 1) / k);
      const sw = Math.min(cv.width - sx, (x1 - x0 + 3) / k), sh = Math.min(cv.height - sy, (y1 - y0 + 3) / k);
      if (sw > cv.width * 0.97 && sh > cv.height * 0.97) return cv;
      const out = blankCanvas(sw, sh);
      out.getContext('2d').drawImage(cv, sx, sy, sw, sh, 0, 0, out.width, out.height);
      return out;
    } catch (e) { return cv; }
  }
  function quarterTurn(cv) {
    const out = blankCanvas(cv.height, cv.width), c = out.getContext('2d');
    c.translate(out.width / 2, out.height / 2);
    c.rotate(Math.PI / 2);
    c.drawImage(cv, -cv.width / 2, -cv.height / 2);
    return out;
  }

  /* ── AUTOMATIC PLACEMENT ─────────────────────────────────────────── */
  const SIDES = ['front', 'right', 'back', 'left'];           // the order panels run across a flat sheet
  const near = (a, b) => Math.abs(Math.log(a / b));           // 0 when two proportions match
  const faceSize = id => { const f = faceList().find(f => f[0] === id); return f ? f[2] : null; };

  // What an uploaded sheet most likely is, judged by its proportions against the
  // product: artwork for one face (perhaps lying on its side), a strip that wraps
  // the four sides, or a flat carton layout that carries the top and bottom too.
  function guessLayout(sheet, faceId) {
    const a = sheet.src.width / sheet.src.height, o = dims(), size = faceSize(faceId), face = size[0] / size[1];
    const straight = near(a, face), turned = near(1 / a, face);
    const oneFace = { layout: 'face', turn: turned < 0.1 && straight > 0.35 };
    if (!type().wraps) return oneFace;
    const round = 2 * o.L + 2 * o.W;
    const spreads = [{ layout: 'wrap', miss: near(a, round / o.H) }, { layout: 'flat', miss: near(a, round / (o.H + 2 * o.W)) }]
      .sort((p, q) => p.miss - q.miss);
    return spreads[0].miss < 0.12 && spreads[0].miss < Math.min(straight, turned) ? { layout: spreads[0].layout, turn: false } : oneFace;
  }

  // Put a sheet on the product the way `sheet.layout` says, replacing wherever it was before.
  function place(sheet, faceId) {
    FACE_IDS.forEach(id => { const f = state.faces[id]; if (f.art && f.art.sheet === sheet) f.art = null; });
    const src = sheet.src, o = dims();
    const cut = (x, y, w, h) => {
      const cv = blankCanvas(w, h);
      cv.getContext('2d').drawImage(src, x, y, w, h, 0, 0, cv.width, cv.height);
      return cv;
    };
    const put = (id, img, fit) => { const f = state.faces[id]; f.art = { img, name: sheet.name, sheet }; f.fit = fit; f.scale = 100; };
    if (sheet.layout === 'face' || !type().wraps) {
      const img = sheet.turn ? quarterTurn(src) : src, size = faceSize(faceId);
      // Close to the face's proportions: fill it and lose a sliver. Otherwise show all of it.
      put(faceId, img, near(img.width / img.height, size[0] / size[1]) < 0.18 ? 'cover' : 'contain');
      sheet.layout = 'face';
      sheet.home = faceId;
      return;
    }
    const round = 2 * o.L + 2 * o.W, flat = sheet.layout === 'flat';
    const bandH = flat ? src.height * o.H / (o.H + 2 * o.W) : src.height, bandY = (src.height - bandH) / 2;
    const first = SIDES.indexOf(sheet.start);
    let x = 0;
    SIDES.slice(first).concat(SIDES.slice(0, first)).forEach(id => {
      const w = src.width * (id === 'front' || id === 'back' ? o.L : o.W) / round;
      put(id, cut(x, bandY, w, bandH), 'cover');
      if (flat && id === 'front') {               // the top and bottom panels hang off the front panel
        put('top', cut(x, 0, w, bandY), 'cover');
        put('bottom', cut(x, bandY + bandH, w, bandY), 'cover');
      }
      x += w;
    });
  }
  // Sheets spread over several faces are cut to the product's proportions, so a new size means cutting again.
  function replaceSpreads() {
    const seen = [];
    FACE_IDS.forEach(id => {
      const art = state.faces[id].art;
      if (!art || art.sheet.layout === 'face' || seen.indexOf(art.sheet) >= 0) return;
      seen.push(art.sheet);
      place(art.sheet, id);
    });
  }

  // The largest clear rectangle on a face, in percent (x across, y up): clear of
  // the window, the hang hole, the seam where a lid meets its base, and the ribbon pull.
  function freeZone(id) {
    const z = { x0: 8, x1: 92, y0: 8, y1: 92 }, t = state.type;
    if (id !== 'front') return z;
    const largerSideOf = seam => { if (seam >= 50) z.y1 = seam - 5; else z.y0 = seam + 5; };
    if (t === 'carton' && state.window.on) {
      const w = state.window, top = w.y + w.h / 2, bottom = w.y - w.h / 2;
      if (100 - top >= bottom) z.y0 = Math.min(top + 4, 86); else z.y1 = Math.max(bottom - 4, 14);
    }
    if (t === 'lidbase') largerSideOf(100 - state.lid);
    if (t === 'shoulder') largerSideOf(56);
    if (t === 'magnetic') largerSideOf(100 - Math.min(62, 7000 / state.H));
    if (t === 'drawer') z.y0 = 66;
    if ((t === 'backer' || t === 'header') && state.hole !== 'none') z.y1 = clamp(100 - 1800 / state.H, 40, 92);
    return z;
  }
  let ruler = null;
  function proportionOf(el) {                     // width ÷ height of an element as it is drawn
    if (el.kind !== 'text') return el.mask.width / el.mask.height;
    ruler = ruler || document.createElement('canvas').getContext('2d');
    ruler.font = el.weight + ' 200px "' + el.font + '"';
    return Math.max(ruler.measureText(el.text || ' ').width, 1) / 150;
  }
  // Text and logos still on automatic share the clear zone, stacked from the top.
  function autoPlace(id) {
    const size = faceSize(id), els = state.faces[id].els.filter(el => el.auto);
    if (!size || !els.length) return;
    const z = freeZone(id), slot = (z.y1 - z.y0) / els.length;
    els.forEach((el, i) => {
      el.x = Math.round((z.x0 + z.x1) / 2);
      el.y = Math.round(z.y1 - (i + 0.5) * slot);
      // As wide as the clear width allows, but no taller than its share of the height.
      const widest = (z.x1 - z.x0) * (el.kind === 'text' ? 0.8 : 0.6);
      const tallest = slot * 0.62 * proportionOf(el) * size[1] / size[0];
      el.size = clamp(Math.round(Math.min(widest, tallest)), 5, 100);
    });
  }
  const autoPlaceAll = () => FACE_IDS.forEach(autoPlace);

  /* ── MODEL ───────────────────────────────────────────────────────── */
  function build() {
    if (model) {
      scene.remove(model);
      model.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    model = type().build(ctx, dims());
    scene.add(model);
    dirty = true;
    if (flat) flat.redraw();                      // a window or hang hole shows on the flat layout too
  }
  // Frame the closed product; opening it must not move the camera.
  function frame() {
    const o = dims();
    orbit.radius = 0.5 * Math.hypot(o.L, o.W, o.H) * (type().opens ? 1.3 : 1.1);
    orbit.target.set(0, o.H * (state.type === 'header' ? 1.2 : 0.5), 0);
    if (state.type === 'header') orbit.radius *= 2.2;
  }
  function poseCamera() {
    // Pull back a little as the product opens, so a raised lid stays in frame.
    const d = orbit.radius / Math.sin(camera.fov * Math.PI / 360) * 1.12 * orbit.zoom * (1 + 0.45 * state.open);
    const fit = camera.aspect < 1 ? 1 / camera.aspect : 1;
    const r = d * fit, sp = Math.sin(orbit.pol);
    camera.position.set(orbit.target.x + r * sp * Math.sin(orbit.az), orbit.target.y + r * Math.cos(orbit.pol), orbit.target.z + r * sp * Math.cos(orbit.az));
    camera.lookAt(orbit.target);
  }

  /* ── CONTROLS: reading state into the page ───────────────────────── */
  function renderTypes() {
    const groups = [];
    B.TYPES.forEach(t => { if (groups.indexOf(t.group) < 0) groups.push(t.group); });
    $('stTypes').innerHTML = groups.map(g =>
      '<h3>' + esc(g) + '</h3><div>' + B.TYPES.filter(t => t.group === g).map(t =>
        '<button type="button" data-type="' + t.id + '" aria-pressed="' + (t.id === state.type) + '"><strong>' + esc(t.name) + '</strong><span>' + esc(t.hint) + '</span></button>'
      ).join('') + '</div>').join('');
  }
  function renderSwatches(query) {
    const q = (query || '').trim().toLowerCase();
    $('stSwatches').innerHTML = P.SPOT_COLOURS.filter(c => !q || c.name.toLowerCase().indexOf(q) >= 0).map(c =>
      '<button type="button" role="option" title="' + esc(c.name) + '" aria-label="' + esc(c.name) + '" aria-selected="' + (c.name === state.colour.name) +
      '" data-colour="' + esc(c.name) + '" style="background:' + c.hex + '"></button>').join('');
    $('stColourName').textContent = state.colour.name + ' (' + state.colour.hex.toUpperCase() + ' on screen)';
    $('stHex').value = state.colour.hex.length === 7 ? state.colour.hex : '#000000';
  }
  function renderFaces() {
    const list = faceList();
    if (!list.some(f => f[0] === state.face)) state.face = list[0][0];
    $('stFaces').innerHTML = list.map(([id, label]) => {
      const f = state.faces[id], used = f.art || f.els.length;
      return '<button type="button" role="tab" data-face="' + id + '" aria-selected="' + (id === state.face) + '">' + esc(label) + (used ? '<i></i>' : '') + '</button>';
    }).join('');
    const face = state.faces[state.face];
    $('stArtInfo').textContent = face.art ? 'Replace ' + face.art.name : 'Upload artwork (PDF, PNG, JPG or SVG)';
    $('stArtControls').hidden = $('stArtRemove').hidden = !face.art;
    if (face.art) {
      const sheet = face.art.sheet, spread = sheet.layout !== 'face';
      artNote((sheet.auto ? 'Placed automatically: ' : 'Your placement: ') + PLACED[sheet.layout] + (sheet.turn && !spread ? ', turned a quarter turn' : '') + (sheet.auto ? '. Change it below if that is not right.' : '.'));
      $('stPlaceWrap').hidden = !type().wraps;
      $('stPlace').value = sheet.layout;
      $('stStartWrap').hidden = !spread;
      $('stStart').value = sheet.start;
      $('stPageWrap').hidden = sheet.source.pages < 2;
      if (sheet.source.pages > 1) {
        $('stPage').innerHTML = Array.from({ length: sheet.source.pages }, (x, i) => '<option value="' + (i + 1) + '"' + (i + 1 === sheet.page ? ' selected' : '') + '>Page ' + (i + 1) + ' of ' + sheet.source.pages + '</option>').join('');
      }
      $('stArtTurn').hidden = spread;
    } else if (!artBusy) artNote('');
    $('stFit').value = face.fit;
    $('stArtScale').value = face.scale;
    $('stArtScaleOut').textContent = face.scale + '%';
    renderElements();
    if (flat) flat.redraw();
  }
  // Edit a face, and turn the product so it is the one in view.
  function selectFace(id) {
    state.face = id;
    if (flat) flat.unpick();
    renderFaces();
    const turn = { front: [0.5, 1.2], back: [Math.PI + 0.5, 1.2], left: [-Math.PI / 2 + 0.4, 1.2], right: [Math.PI / 2 - 0.4, 1.2], top: [0.5, 0.5], bottom: [0.5, 2.5] }[id];
    if (turn) { orbit.az = turn[0]; orbit.pol = turn[1]; orbit.idle = 0; dirty = true; }
  }
  function renderElements() {
    const face = state.faces[state.face];
    $('stEls').innerHTML = face.els.map(el => {
      const slider = (key, label, min, max) => '<label class="st-slider">' + label + ' <output>' + el[key] + '%</output><input type="range" data-k="' + key + '" min="' + min + '" max="' + max + '" value="' + el[key] + '" /></label>';
      const f = finish(el.finish), flat = f.id !== 'emboss' && f.id !== 'deboss';
      return '<div class="st-el" data-el="' + el.id + '">' +
        '<div class="st-el-head"><span>' + (el.kind === 'text' ? 'Text' : 'Logo: ' + esc(el.name)) + '</span><button type="button" data-del>Remove</button></div>' +
        (el.kind === 'text'
          ? '<label class="st-field">Wording<input type="text" data-k="text" value="' + esc(el.text) + '" maxlength="60" /></label>' +
            '<label class="st-field">Typeface<select data-k="font">' + FONTS.map(([n]) => '<option' + (n === el.font ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></label>'
          : '') +
        '<label class="st-field">Finish<select data-k="finish">' + P.FINISHES.map(o => '<option value="' + o.id + '"' + (o.id === el.finish ? ' selected' : '') + '>' + esc(o.name) + '</option>').join('') + '</select></label>' +
        (f.id === 'print' && el.kind === 'text' ? '<label class="st-field">Ink colour<input type="color" data-k="colour" value="' + el.colour + '" /></label>' : '') +
        (el.auto ? '<p class="st-auto">Positioned automatically. Move a slider to place it by hand.</p>'
                 : '<button type="button" class="st-link" data-auto>Position it automatically</button>') +
        slider('size', 'Size', 5, 100) + slider('x', 'Across', 0, 100) + slider('y', 'Up', 0, 100) +
        (flat ? '<label class="st-check"><input type="checkbox" data-k="raised"' + (el.raised ? ' checked' : '') + ' /> Also emboss it</label>' : '') +
        '</div>';
    }).join('');
  }
  function renderControls() {
    const t = type(), labels = t.dims || { L: 'Length', W: 'Width', H: 'Height' }, has = k => (t.controls || []).indexOf(k) >= 0;
    $('stL').value = state.L; $('stW').value = state.W; $('stH').value = state.H;
    $('stLLabel').textContent = labels.L; $('stHLabel').textContent = labels.H;
    $('stWWrap').hidden = labels.W === null;
    if (labels.W) $('stWLabel').textContent = labels.W;
    $('stLidWrap').hidden = !has('lid');
    $('stLipWrap').hidden = !has('lip');
    $('stHoleWrap').hidden = !has('hole');
    $('stWindowWrap').hidden = !has('window');
    $('stProductWrap').hidden = !(has('product') || (has('window') && state.window.on));
    $('stOpenWrap').hidden = !t.opens;
    $('stLid').value = state.lid; $('stLidOut').textContent = state.lid + '% of height';
    $('stLip').value = state.lip; $('stLipOut').textContent = state.lip + '% of height';
    if (t.lipLabel) $('stLipLabel').textContent = t.lipLabel;
    $('stHole').value = state.hole;
    $('stProduct').checked = state.product;
    const w = state.window;
    $('stWindowOn').checked = w.on;
    $('stWindowControls').hidden = !w.on;
    $('stWindowShape').value = w.shape;
    [['W', 'w'], ['H', 'h'], ['X', 'x'], ['Y', 'y']].forEach(([s, k]) => { $('stWin' + s).value = w[k]; $('stWin' + s + 'Out').textContent = w[k] + '%'; });
    $('stOpen').value = Math.round(state.open * 100);
  }

  /* ── THE SPEC ────────────────────────────────────────────────────── */
  function spec() {
    const t = type(), labels = t.dims || { L: 'Length', W: 'Width', H: 'Height' }, has = k => (t.controls || []).indexOf(k) >= 0;
    const size = [[labels.L, state.L], [labels.W, state.W], [labels.H, state.H]].filter(d => d[0]);
    const lines = [
      'Product: ' + t.name,
      'Size: ' + size.map(d => d[0] + ' ' + d[1] + ' mm').join(', '),
      'Outside colour: ' + state.colour.name,
      'Inside: ' + state.inside.name,
      'Coating: ' + P.COATINGS.find(k => k.id === state.coating).name,
    ];
    if (has('lid')) lines.push('Lid depth: ' + state.lid + '% of height');
    if (has('lip')) lines.push(t.lipLabel + ': ' + state.lip + '% of height');
    if (has('hole')) lines.push('Hang hole: ' + ({ slot: 'slot', round: 'round', none: 'none' })[state.hole]);
    if (has('window')) {
      const w = state.window;
      lines.push(w.on
        ? 'Window: ' + ({ rounded: 'rounded rectangle', rect: 'rectangle', oval: 'oval' })[w.shape] + ', ' +
          Math.round(state.L * w.w / 100) + ' × ' + Math.round(state.H * w.h / 100) + ' mm, centred ' +
          Math.round(state.L * w.x / 100) + ' mm across and ' + Math.round(state.H * w.y / 100) + ' mm up the front'
        : 'Window: none');
    }
    // A sheet spread over several faces is listed once; artwork for one face is listed with that face.
    const named = art => '"' + art.name + '"' + (art.sheet.source.pages > 1 ? ', page ' + art.sheet.page : '');
    const spreads = [];
    faceList().forEach(([id]) => {
      const art = state.faces[id].art;
      if (!art || art.sheet.layout === 'face' || spreads.indexOf(art.sheet) >= 0) return;
      spreads.push(art.sheet);
      lines.push('Artwork: ' + named(art) + ', ' + PLACED[art.sheet.layout]);
    });
    faceList().forEach(([id, label]) => {
      const f = state.faces[id], parts = [];
      if (f.art && f.art.sheet.layout === 'face') parts.push('artwork ' + named(f.art));
      f.els.forEach(el => parts.push(
        finish(el.finish).name.toLowerCase() + (el.raised ? ', embossed' : '') + ': ' +
        (el.kind === 'text' ? '"' + el.text + '" in ' + el.font : 'logo "' + el.name + '"')));
      if (parts.length) lines.push(label + ': ' + parts.join('; '));
    });
    return lines.join('\n');
  }
  const renderSpec = () => { $('stSpec').textContent = spec(); };

  /* ── CHANGES ─────────────────────────────────────────────────────── */
  // Everything that follows a change, from the cheapest to the most thorough.
  function changed(what) {
    // A new style, size or opening moves what is clear on a face, so anything on automatic is placed again.
    if (what === 'style' || what === 'size' || what === 'shape') { replaceSpreads(); autoPlaceAll(); }
    if (what === 'style') { frame(); renderControls(); renderFaces(); build(); composeAll(); }
    else if (what === 'size') { frame(); renderFaces(); build(); composeAll(); }   // face proportions changed
    else if (what === 'shape') { renderControls(); renderElements(); build(); composeAll(); }
    else if (what === 'surface') composeAll();
    else if (what === 'face') { autoPlace(state.face); compose(state.face); renderFaces(); }
    else if (what === 'art') { composeAll(); renderFaces(); }                       // a sheet can land on several faces
    renderSpec();
  }

  const PLACED = { face: 'on this face', wrap: 'wrapped around the four sides', flat: 'as a flat carton layout, with the four sides, top and bottom' };
  let artBusy = false;
  function artNote(text, isError) {
    const note = $('stArtNote');
    note.textContent = text;
    note.hidden = !text;
    note.classList.toggle('is-error', !!isError);
  }
  // Read a page of an artwork file and place it. `sheet` is what is kept about
  // it: where it came from, the trimmed page, and how it is laid on the product.
  function showPage(sheet, faceId) {
    return sheet.source.page(sheet.page).then(raw => {
      sheet.src = trim(raw);
      if (sheet.auto) Object.assign(sheet, guessLayout(sheet, faceId));
      place(sheet, faceId);
      changed('art');
    });
  }

  function bind() {
    $('stTypes').addEventListener('click', e => {
      const b = e.target.closest('button[data-type]');
      if (!b || b.dataset.type === state.type) return;
      const t = B.byId(b.dataset.type);
      state.type = t.id;
      [state.L, state.W, state.H] = t.size;
      if (t.lip !== undefined) state.lip = t.lip;
      state.open = 0;
      renderTypes();
      changed('style');
    });

    [['stL', 'L', 20], ['stW', 'W', 10], ['stH', 'H', 20]].forEach(([id, key, min]) => {
      $(id).addEventListener('input', e => {
        const v = parseFloat(e.target.value);
        if (!isFinite(v)) return;
        state[key] = clamp(Math.round(v), min, 800);
        changed('size');
      });
      $(id).addEventListener('change', e => { e.target.value = state[key]; });
    });

    const number = (id, set, what) => $(id).addEventListener('input', e => { set(parseInt(e.target.value, 10)); changed(what); if (what !== 'surface') renderControls(); });
    number('stLid', v => { state.lid = v; }, 'size');
    number('stLip', v => { state.lip = v; }, 'size');
    number('stWinW', v => { state.window.w = v; }, 'shape');
    number('stWinH', v => { state.window.h = v; }, 'shape');
    number('stWinX', v => { state.window.x = v; }, 'shape');
    number('stWinY', v => { state.window.y = v; }, 'shape');
    $('stOpen').addEventListener('input', e => { state.open = e.target.value / 100; build(); });
    $('stHole').addEventListener('change', e => { state.hole = e.target.value; changed('shape'); });
    $('stWindowShape').addEventListener('change', e => { state.window.shape = e.target.value; changed('shape'); });
    $('stWindowOn').addEventListener('change', e => { state.window.on = e.target.checked; changed('shape'); });
    $('stProduct').addEventListener('change', e => { state.product = e.target.checked; changed('shape'); });

    $('stSwatches').addEventListener('click', e => {
      const b = e.target.closest('button[data-colour]');
      if (!b) return;
      state.colour = P.SPOT_COLOURS.find(c => c.name === b.dataset.colour);
      renderSwatches($('stColourSearch').value);
      changed('surface');
    });
    $('stColourSearch').addEventListener('input', e => renderSwatches(e.target.value));
    $('stHex').addEventListener('input', e => {
      state.colour = { name: 'Custom colour ' + e.target.value.toUpperCase(), hex: e.target.value };
      renderSwatches($('stColourSearch').value);
      changed('surface');
    });
    $('stInside').addEventListener('change', e => {
      state.inside = P.STOCKS.find(s => s.name === e.target.value);
      [mat.inside, mat.insideBack].forEach(m => m.color.set(state.inside.hex).convertSRGBToLinear());
      dirty = true;
      renderSpec();
    });
    $('stCoating').addEventListener('change', e => { state.coating = e.target.value; changed('surface'); });

    $('stFaces').addEventListener('click', e => {
      const b = e.target.closest('button[data-face]');
      if (b) selectFace(b.dataset.face);
    });

    const failed = err => { artBusy = false; artNote((err && err.message) || 'That file could not be read.', true); };
    $('stArt').addEventListener('change', e => {
      const file = e.target.files[0], faceId = state.face;
      e.target.value = '';
      if (!file) return;
      artBusy = true;
      artNote('Reading ' + file.name + '…');
      openArtwork(file)
        .then(source => {
          const old = state.faces[faceId].art;
          if (old) FACE_IDS.forEach(id => { const f = state.faces[id]; if (f.art && f.art.sheet === old.sheet) f.art = null; });
          return showPage({ source, name: source.name, page: 1, start: 'front', turn: false, auto: true }, faceId);
        })
        .then(() => { artBusy = false; }, failed);
    });
    const sheetHere = () => { const art = state.faces[state.face].art; return art && art.sheet; };
    $('stArtRemove').addEventListener('click', () => {
      const sheet = sheetHere();
      FACE_IDS.forEach(id => { const f = state.faces[id]; if (f.art && f.art.sheet === sheet) f.art = null; });
      changed('art');
    });
    // Choosing a placement by hand switches the guessing off for this sheet.
    const replace = change => {
      const sheet = sheetHere();
      if (!sheet) return;
      change(sheet);
      place(sheet, state.face);
      changed('art');
    };
    $('stPlace').addEventListener('change', e => replace(sheet => { sheet.layout = e.target.value; sheet.auto = false; }));
    $('stStart').addEventListener('change', e => replace(sheet => { sheet.start = e.target.value; sheet.auto = false; }));
    $('stArtTurn').addEventListener('click', () => replace(sheet => { sheet.turn = !sheet.turn; sheet.auto = false; }));
    $('stPage').addEventListener('change', e => {
      const sheet = sheetHere();
      if (!sheet) return;
      sheet.page = parseInt(e.target.value, 10);
      showPage(sheet, state.face).catch(failed);
    });
    $('stArtAuto').addEventListener('click', () => {
      const sheet = sheetHere();
      if (!sheet) return;
      sheet.auto = true;
      sheet.turn = false;
      showPage(sheet, state.face).catch(failed);
    });
    $('stFit').addEventListener('change', e => { state.faces[state.face].fit = e.target.value; changed('face'); });
    $('stArtScale').addEventListener('input', e => {
      state.faces[state.face].scale = parseInt(e.target.value, 10);
      $('stArtScaleOut').textContent = e.target.value + '%';
      compose(state.face);
    });

    $('stAddText').addEventListener('click', () => {
      state.faces[state.face].els.push({ id: nextId++, kind: 'text', text: 'YOUR BRAND', font: 'Montserrat', weight: 700, finish: 'foil-gold', colour: '#ffffff', size: 62, x: 50, y: 50, raised: false, auto: true });
      changed('face');
    });
    $('stAddImage').addEventListener('change', e => {
      const file = e.target.files[0], faceId = state.face;
      e.target.value = '';
      if (!file) return;
      openArtwork(file).then(source => source.page(1)).then(raw => {
        const img = trim(raw), k = Math.min(1, RES / Math.max(img.width, img.height));
        state.faces[faceId].els.push({ id: nextId++, kind: 'image', img, name: file.name, mask: stencil(img, Math.round(img.width * k), Math.round(img.height * k)), finish: 'print', size: 50, x: 50, y: 50, raised: false, auto: true });
        changed('face');
      }).catch(failed);
    });
    const elementOf = e => {
      const card = e.target.closest('.st-el');
      return card && state.faces[state.face].els.find(el => el.id === +card.dataset.el);
    };
    $('stEls').addEventListener('input', e => {
      const el = elementOf(e), key = e.target.dataset.k;
      if (!el || !key) return;
      if (e.target.type === 'checkbox') el[key] = e.target.checked;
      else if (e.target.type === 'range') { el[key] = parseInt(e.target.value, 10); e.target.previousElementSibling.textContent = el[key] + '%'; el.auto = false; }
      else el[key] = e.target.value;
      if (key === 'font') el.weight = FONTS.find(f => f[0] === el.font)[1];
      if (key === 'text' || key === 'font') autoPlace(state.face);   // new wording has new proportions
      compose(state.face);
      renderSpec();
      if (key === 'finish') renderElements();        // the finish decides which other settings apply
    });
    // Once a slider is let go, or wording is finished, show the card as it now stands.
    $('stEls').addEventListener('change', e => { if (/^(size|x|y|text|font)$/.test(e.target.dataset.k || '')) renderElements(); });
    $('stEls').addEventListener('click', e => {
      if (e.target.hasAttribute('data-auto')) { const el = elementOf(e); if (el) { el.auto = true; changed('face'); } return; }
      if (!e.target.hasAttribute('data-del')) return;
      const el = elementOf(e), face = state.faces[state.face];
      if (flat) flat.unpick();
      face.els.splice(face.els.indexOf(el), 1);
      changed('face');
    });

    /* ── View: turn, zoom, reset, download ───────────────────────── */
    let drag = null, pinch = 0;
    const pointers = new Map();
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, e);
      drag = { x: e.clientX, y: e.clientY };
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY); }
    });
    canvas.addEventListener('pointermove', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, e);
      orbit.idle = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) orbit.zoom = clamp(orbit.zoom * pinch / d, 0.45, 2.4);
        pinch = d;
      } else if (drag) {
        orbit.az -= (e.clientX - drag.x) * 0.008;
        orbit.pol = clamp(orbit.pol - (e.clientY - drag.y) * 0.006, 0.12, Math.PI - 0.12);
        drag = { x: e.clientX, y: e.clientY };
      }
      dirty = true;
    });
    const release = e => { pointers.delete(e.pointerId); drag = null; pinch = 0; };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      orbit.zoom = clamp(orbit.zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.45, 2.4);
      orbit.idle = 0;
      dirty = true;
    }, { passive: false });
    $('stReset').addEventListener('click', () => { orbit.az = 0.62; orbit.pol = 1.18; orbit.zoom = 1; dirty = true; });
    $('stShot').addEventListener('click', () => {
      poseCamera();
      renderer.render(scene, camera);                   // the drawing buffer is only readable right after a render
      // The download is the view on its studio backdrop, with the Kraftman Packaging watermark over it.
      const out = blankCanvas(canvas.width, canvas.height), c = out.getContext('2d'), w = out.width, h = out.height;
      const backdrop = c.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.7);
      backdrop.addColorStop(0, '#ffffff'); backdrop.addColorStop(0.62, '#eef0f3'); backdrop.addColorStop(1, '#dfe3e8');
      c.fillStyle = backdrop; c.fillRect(0, 0, w, h);
      c.drawImage(canvas, 0, 0);
      watermark(c, w, h);
      const a = document.createElement('a');
      a.download = 'kraftman-' + state.type + '-' + state.L + 'x' + state.W + 'x' + state.H + '.png';
      a.href = out.toDataURL('image/png');
      a.click();
    });

    /* ── View: 3D, the flat layout, or both side by side ─────────── */
    const setMode = mode => {
      view.className = 'st-view mode-' + mode;
      $('stModes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      resize();
      if (flat) flat.redraw();
    };
    $('stModes').addEventListener('click', e => { const b = e.target.closest('button[data-mode]'); if (b) setMode(b.dataset.mode); });
    $('stFlatSave').addEventListener('click', () => {
      if (!flat) return;
      const a = document.createElement('a');
      a.download = 'kraftman-' + state.type + '-' + state.L + 'x' + state.W + 'x' + state.H + '-layout.svg';
      a.href = URL.createObjectURL(new Blob([flat.svg()], { type: 'image/svg+xml' }));
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    });

    const pane = canvas.parentElement;
    function resize() {
      const w = pane.clientWidth, h = pane.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    window.addEventListener('resize', resize);
    if (window.ResizeObserver) new ResizeObserver(resize).observe(pane);
    setMode(window.innerWidth >= 1100 ? 'both' : '3d');
  }

  /* ── WATERMARK on downloaded images ──────────────────────────────── */
  // The name repeated faintly across the picture, and the logo with the site
  // address in the corner, so a shared image always says where it came from.
  let brandLogo = null;                           // the logo from Site Settings, once it has loaded
  function watermark(c, w, h) {
    const size = Math.max(14, Math.round(w / 46)), stepX = size * 17, stepY = size * 6.5;
    c.save();
    c.translate(w / 2, h / 2);
    c.rotate(-Math.PI / 7);
    c.font = '600 ' + size + 'px Inter, Arial, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(11, 11, 12, 0.07)';
    const reach = Math.hypot(w, h) / 2;
    for (let y = -reach, row = 0; y <= reach; y += stepY, row++) {
      for (let x = -reach - (row % 2 ? stepX / 2 : 0); x <= reach; x += stepX) c.fillText('KRAFTMAN PACKAGING', x, y);
    }
    c.restore();

    const pad = Math.round(w * 0.022), label = 'Made in Kraftman 3D Studio  ·  kraftmanpackaging.com';
    c.save();
    c.font = '500 ' + Math.max(11, Math.round(w / 82)) + 'px Inter, Arial, sans-serif';
    c.textBaseline = 'middle';
    const lh = Math.max(34, Math.round(h * 0.07)), lw = brandLogo ? lh * brandLogo.naturalWidth / brandLogo.naturalHeight : 0;
    const tw = c.measureText(label).width, bw = lw + tw + pad * (brandLogo ? 2.2 : 1.6), bh = lh + pad * 0.7;
    const x = w - bw - pad, y = h - bh - pad;
    c.fillStyle = 'rgba(255, 255, 255, 0.92)'; c.fillRect(x, y, bw, bh);
    if (brandLogo) c.drawImage(brandLogo, x + pad * 0.6, y + (bh - lh) / 2, lw, lh);
    c.fillStyle = '#0b0b0c';
    c.fillText(label, x + (brandLogo ? lw + pad * 1.4 : pad * 0.8), y + bh / 2);
    c.restore();
  }

  /* ── QUOTE FORM (works with or without the 3D view) ──────────────── */
  function bindForm() {
    const form = $('stForm'), note = $('stNote');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const say = (text, isError) => { note.textContent = text; note.classList.toggle('is-error', !!isError); };
      if (!data.name || !data.email) return say('Please add your name and email so we can reply.', true);
      const button = form.querySelector('button');
      button.disabled = true;
      say('Sending…');
      const message = '3D studio specification\n\n' + spec() + (data.notes ? '\n\nQuantity and notes: ' + data.notes : '');
      fetch('/api/enquiry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: data.name, email: data.email, phone: data.phone, company: data.company, product_interest: type().name + ' (3D studio)', message }),
      })
        .then(r => r.json().then(body => ({ ok: r.ok, body })))
        .then(res => say(res.ok ? 'Sent. We will reply within 24 hours and ask for your print files.' : (res.body.error || 'Could not send. Please email us instead.'), !res.ok))
        .catch(() => say('Could not send. Please email us instead.', true))
        .then(() => { button.disabled = false; });
    });
  }

  /* ── START ───────────────────────────────────────────────────────── */
  $('stInside').innerHTML = P.STOCKS.map(s => '<option>' + esc(s.name) + '</option>').join('');
  $('stCoating').innerHTML = P.COATINGS.map(c => '<option value="' + c.id + '">' + esc(c.name) + '</option>').join('');
  renderTypes();
  renderSwatches();
  renderControls();
  renderFaces();
  renderSpec();
  bindForm();

  // Header brand: the logo from Site Settings, when one is set.
  fetch('/api/settings').then(r => (r.ok ? r.json() : null)).then(s => {
    if (!s || !s.site_logo) return;
    const img = new Image();
    img.alt = 'Kraftman Packaging';
    img.onload = () => { brandLogo = img; $('stBrand').textContent = ''; $('stBrand').appendChild(img); };
    img.src = s.site_logo;
  }).catch(() => {});

  if (!renderer) return;
  initScene();
  if (window.StudioFlat) {
    flat = window.StudioFlat.create({
      canvas: $('stFlat'), state, faces: faceList, typeId: () => state.type, proportionOf,
      surface: id => surfaces[id].colour.cv,
      selectFace,
      moved: compose,                               // while dragging: redraw that face, here and in 3D
      settled: () => { renderElements(); renderSpec(); },
    });
  }
  bind();
  changed('style');
  // Text is drawn onto canvases, which does not make the browser fetch a web
  // font by itself. Ask for each typeface, then redraw once they have arrived.
  if (document.fonts && document.fonts.load) {
    Promise.all(FONTS.map(([name, weight]) => document.fonts.load(weight + ' 20px "' + name + '"'))).then(composeAll).catch(() => {});
  }

  let last = 0;
  (function tick(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
    last = now;
    orbit.idle += dt;
    // Turning slowly keeps reflections moving, which is how foil and gloss read as foil and gloss.
    if ($('stSpin').checked && orbit.idle > 2.5 && !document.hidden) { orbit.az += dt * 0.22; dirty = true; }
    if (dirty) { dirty = false; poseCamera(); renderer.render(scene, camera); }
    requestAnimationFrame(tick);
  })(0);
})();
