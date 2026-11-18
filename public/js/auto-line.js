/* ═══════════════════════════════════════════════════════════════════
   Automatic rigid box line — the homepage scene (Three.js r128)

   A continuously running line in a factory hall: wrap feeder → gluer →
   camera-guided robot positioning → wrapping/forming → stacker. Nobody
   touches the product; an operator supervises from a tablet.

   Unlike the scroll-driven story pages this one runs on a clock. Every
   box is a pure function of its age, so the line is already full the
   moment it first renders and loops forever without any state.
   Units are metres. Loaded on demand by auto-line-loader.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const stage  = document.getElementById('autolineStage');
  const canvas = document.getElementById('autolineCanvas');
  if (!stage || !canvas) return;

  let renderer = null;
  if (window.THREE) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
    catch (e) { renderer = null; }
  }
  if (!renderer) { stage.classList.add('autoline-no3d'); return; }

  const HALF = Math.PI / 2;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const seg  = (v, a, b) => clamp01((v - a) / (b - a));
  const io   = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  // r128 treats hex colours as linear; convert so they render as authored.
  const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = srgb(0xe9edf1);
  const camera = new THREE.PerspectiveCamera(38, 2.2, 0.1, 120);

  /* ── MATERIALS ───────────────────────────────────────────────────── */
  const std = (hex, rough, extra) =>
    new THREE.MeshStandardMaterial(Object.assign({ color: srgb(hex), roughness: rough }, extra || {}));
  const glow = (hex, intensity) =>
    new THREE.MeshStandardMaterial({ color: srgb(hex), emissive: srgb(hex), emissiveIntensity: intensity, roughness: 0.5 });
  const M = {
    white:  std(0xf1f3f6, 0.45),
    black:  std(0x16191e, 0.42),
    dark:   std(0x2a2e35, 0.6),
    alu:    std(0xb7bec6, 0.35, { metalness: 0.45 }),
    belt:   std(0x25282e, 0.9),
    glass:  std(0x1b2a3c, 0.08, { transparent: true, opacity: 0.3, metalness: 0.2, depthWrite: false }),
    blue:   std(0x1f6fd6, 0.45),
    board:  std(0xa39c90, 0.95),
    tape:   std(0xb48a52, 0.7),
    floor:  std(0xc7d1cd, 0.3),
    wall:   std(0xf4f6f8, 0.9),
    ceil:   new THREE.MeshStandardMaterial({ color: srgb(0xdfe3e8), emissive: srgb(0xdfe3e8), emissiveIntensity: 0.3, roughness: 1 }),
    navy:   std(0x1b3252, 0.5),
    gold:   std(0xd29a2a, 0.55),
    yellow: std(0xf2c230, 0.6),
    red:    std(0xc9352b, 0.5),
    led:    glow(0xffffff, 1.6),
    green:  glow(0x2fc46b, 1.3),
    skin:   std(0xf1c7a4, 0.75),
    hair:   std(0x3a2417, 0.7),
    shoe:   std(0x2b2f36, 0.7),
    eye:    std(0x2a1c14, 0.4),
    mouth:  std(0xb4524b, 0.6),
  };
  // The rigid box finishes the line turns out, one after another.
  const FINISHES = [0x1b3252, 0xf2ece0, 0x7c1f2d, 0x23513f, 0x1c1c1f, 0xc9a25e];

  /* ── SMALL BUILDERS ──────────────────────────────────────────────── */
  function box(w, h, d, mat, shadow) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    if (shadow !== false) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function cyl(r, h, mat, segs) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs || 20), mat);
    m.castShadow = true;
    return m;
  }
  function group(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    parent.add(g);
    return g;
  }
  function at(mesh, parent, x, y, z) { mesh.position.set(x, y, z); parent.add(mesh); return mesh; }

  /* ── THE HALL: floor, walls, lit ceiling, air conditioning ───────── */
  const CEIL_Y = 4.5, BACK_Z = -7, LEFT_X = -16, RIGHT_X = 22, FRONT_Z = 18;
  (function () {
    const floor = at(box(RIGHT_X - LEFT_X, 0.1, FRONT_Z - BACK_Z, M.floor), scene, (LEFT_X + RIGHT_X) / 2, -0.05, (BACK_Z + FRONT_Z) / 2);
    floor.castShadow = false;

    const wallW = RIGHT_X - LEFT_X;
    at(box(wallW, CEIL_Y, 0.1, M.wall, false), scene, (LEFT_X + RIGHT_X) / 2, CEIL_Y / 2, BACK_Z - 0.05);
    at(box(wallW, 1.1, 0.02, M.navy, false), scene, (LEFT_X + RIGHT_X) / 2, 0.55, BACK_Z + 0.011);     // dado band
    at(box(wallW, 0.05, 0.02, M.gold, false), scene, (LEFT_X + RIGHT_X) / 2, 1.13, BACK_Z + 0.012);
    at(box(0.1, CEIL_Y, FRONT_Z - BACK_Z, M.wall, false), scene, LEFT_X - 0.05, CEIL_Y / 2, (BACK_Z + FRONT_Z) / 2);
    at(box(0.02, 1.1, FRONT_Z - BACK_Z, M.navy, false), scene, LEFT_X + 0.011, 0.55, (BACK_Z + FRONT_Z) / 2);

    at(box(wallW, 0.1, FRONT_Z - BACK_Z, M.ceil, false), scene, (LEFT_X + RIGHT_X) / 2, CEIL_Y + 0.05, (BACK_Z + FRONT_Z) / 2);

    // Recessed LED panels in rows down the hall.
    const panelGeo = new THREE.BoxGeometry(1.9, 0.03, 0.5);
    const frameGeo = new THREE.BoxGeometry(2.0, 0.02, 0.6);
    for (let z = -5.2; z <= 11; z += 2.6) {
      for (let x = -13.5; x <= 20; x += 3.35) {
        const f = new THREE.Mesh(frameGeo, M.alu); f.position.set(x, CEIL_Y - 0.008, z); scene.add(f);
        const p = new THREE.Mesh(panelGeo, M.led); p.position.set(x, CEIL_Y - 0.02, z); scene.add(p);
      }
    }

    // Ceiling cassette air conditioners.
    [[-5.2, 1.3], [6.6, 1.3], [0.7, -3.9], [14.0, -3.9], [-10.2, -3.9]].forEach(([x, z]) => {
      const g = group(scene, x, CEIL_Y, z);
      at(box(1.2, 0.07, 1.2, M.white, false), g, 0, -0.035, 0);
      at(box(1.0, 0.075, 1.0, M.dark, false), g, 0, -0.04, 0);
      at(box(0.78, 0.085, 0.78, M.white, false), g, 0, -0.045, 0);
      at(box(0.06, 0.09, 0.06, M.green, false), g, 0.3, -0.047, 0.3);
    });
    // Wall-mounted split units and a supply duct along the back wall.
    [-11.2, 12.5].forEach(x => {
      const g = group(scene, x, 3.72, BACK_Z + 0.16);
      at(box(1.35, 0.4, 0.3, M.white), g, 0, 0, 0);
      at(box(1.2, 0.04, 0.02, M.dark, false), g, 0, -0.13, 0.155);
      at(box(0.05, 0.03, 0.02, M.green, false), g, 0.55, 0.1, 0.155);
    });
    const duct = cyl(0.2, wallW - 4, M.alu, 28);
    duct.rotation.z = HALF;
    at(duct, scene, (LEFT_X + RIGHT_X) / 2, 4.14, BACK_Z + 0.75);
    for (let x = -12; x <= 19; x += 5.2) at(box(0.7, 0.1, 0.34, M.white, false), scene, x, 3.92, BACK_Z + 0.75);

    // Wall sign: the company logo from Site Settings on a mounted board.
    // Until it loads — or if no logo is set — the name is drawn as lettering.
    // A page that already shows the logo above the scene turns the sign off
    // with data-sign="off" on the stage, so the logo is not seen twice.
    // data-sign="headline" letters the page's headline on the wall instead (see WALL HEADLINE below).
    if (!stage.getAttribute('data-sign')) {
    const SIGN_X = -4.3, SIGN_Y = 3.0;
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 220;
    const tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    const signMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), signMat);
    sign.position.set(SIGN_X, SIGN_Y, BACK_Z + 0.02);
    sign.scale.set(5.6, 5.6 * 220 / 1024, 1);
    scene.add(sign);
    const draw = () => {
      const c = cv.getContext('2d');
      c.clearRect(0, 0, 1024, 220);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#0F1C2E'; c.font = '800 96px Montserrat, Arial, sans-serif';
      c.fillText('KRAFTMAN', 512, 70);
      c.fillStyle = '#C8860A'; c.fillRect(262, 128, 500, 6);
      c.font = '700 40px Montserrat, Arial, sans-serif';
      c.fillText('P A C K A G I N G', 512, 176);
      tex.needsUpdate = true;
    };
    draw();
    if (window.fetch) {
      fetch('/api/settings')
        .then(r => (r.ok ? r.json() : null))
        .then(settings => {
          if (!settings || !settings.site_logo) return;
          new THREE.TextureLoader().load(settings.site_logo, logo => {
            logo.encoding = THREE.sRGBEncoding;
            logo.anisotropy = renderer.capabilities.getMaxAnisotropy();
            const h = 1.5, w = h * logo.image.width / logo.image.height;
            at(box(w + 0.36, h + 0.36, 0.04, M.white, false), scene, SIGN_X, SIGN_Y, BACK_Z + 0.025);
            at(box(w + 0.44, h + 0.44, 0.02, M.alu, false), scene, SIGN_X, SIGN_Y, BACK_Z + 0.012);
            signMat.map = logo;
            signMat.transparent = false;
            signMat.needsUpdate = true;
            sign.position.z = BACK_Z + 0.05;
            sign.scale.set(w, h, 1);
            kick();
          });
        })
        .catch(() => {});
    }
    }

    // Safety marking around the line, and a fire extinguisher on the wall.
    const mark = (w, d, x, z) => at(box(w, 0.006, d, M.yellow, false), scene, x, 0.004, z);
    mark(24.6, 0.09, 0.9, 1.95); mark(24.6, 0.09, 0.9, -3.75); mark(0.09, 5.7, -11.4, -0.9); mark(0.09, 5.7, 13.2, -0.9);
    at(cyl(0.09, 0.5, M.red), scene, -13.4, 1.25, BACK_Z + 0.14);
  })();

  /* ── LIGHT ───────────────────────────────────────────────────────── */
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4ccd2, 0.82));
  const key = new THREE.DirectionalLight(0xffffff, 0.5);
  key.position.set(-5, 13, 9);
  key.target.position.set(1, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -15; key.shadow.camera.right = 15;
  key.shadow.camera.top = 9;    key.shadow.camera.bottom = -9;
  key.shadow.camera.near = 1;   key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.updateProjectionMatrix();
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xeaf1ff, 0.22);
  fill.position.set(9, 6, 10);
  scene.add(fill);

  /* ── MACHINE PARTS ───────────────────────────────────────────────── */
  const DECK = 0.9;                // top of every machine base
  const BELT_Y = 0.94;             // conveying surface

  // Operator screen: a dark panel with a simple run display.
  const hmiTex = (function () {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 180;
    const c = cv.getContext('2d');
    c.fillStyle = '#0c1b2b'; c.fillRect(0, 0, 256, 180);
    c.fillStyle = '#16a3a8'; c.fillRect(0, 0, 256, 26);
    c.fillStyle = '#1d3550';
    [[12, 38, 110, 60], [134, 38, 110, 60], [12, 108, 150, 60]].forEach(r => c.fillRect(r[0], r[1], r[2], r[3]));
    c.fillStyle = '#35d07f'; c.fillRect(176, 118, 68, 40);
    c.fillStyle = '#8fd6ff';
    [18, 34, 50, 66, 82, 98].forEach((x, i) => c.fillRect(x, 92 - [22, 34, 28, 40, 30, 36][i], 10, [22, 34, 28, 40, 30, 36][i]));
    c.strokeStyle = '#ffd166'; c.lineWidth = 3; c.beginPath();
    [[142, 84], [164, 62], [186, 72], [208, 50], [236, 58]].forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
    c.stroke();
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })();
  const hmiMat = new THREE.MeshStandardMaterial({ map: hmiTex, emissive: 0xffffff, emissiveMap: hmiTex, emissiveIntensity: 0.9, roughness: 0.3 });
  function hmi(parent, x, y, z) {
    const g = group(parent, x, y, z);
    at(box(0.05, 0.05, 0.34, M.alu), g, 0, 0.2, -0.17);                 // swing arm
    at(box(0.46, 0.34, 0.05, M.black), g, 0, 0, 0);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.28), hmiMat);
    screen.position.set(0, 0, 0.027);
    g.add(screen);
    g.rotation.x = -0.18;
  }
  function stackLight(parent, x, y, z) {
    const g = group(parent, x, y, z);
    at(cyl(0.015, 0.22, M.alu, 8), g, 0, 0.11, 0);
    at(cyl(0.04, 0.07, M.red, 14), g, 0, 0.26, 0);
    at(cyl(0.04, 0.07, M.yellow, 14), g, 0, 0.335, 0);
    at(cyl(0.04, 0.07, M.green, 14), g, 0, 0.41, 0);
  }

  // A machine base: white cabinet on feet with a dark plinth, door seams,
  // handles and vent louvres on the operator side.
  function base(parent, w, d, doors) {
    at(box(w, DECK - 0.1, d, M.white), parent, 0, 0.1 + (DECK - 0.1) / 2, 0);
    at(box(w + 0.01, 0.1, d + 0.01, M.dark), parent, 0, 0.13, 0).castShadow = false;
    [1, -1].forEach(sx => [1, -1].forEach(sz => at(cyl(0.035, 0.08, M.black, 10), parent, sx * (w / 2 - 0.1), 0.04, sz * (d / 2 - 0.1))));
    const f = d / 2 + 0.002, dw = w / doors;
    for (let i = 0; i < doors; i++) {
      const cx = -w / 2 + dw * (i + 0.5);
      if (i > 0) at(box(0.008, DECK - 0.24, 0.004, M.dark, false), parent, -w / 2 + dw * i, 0.52, f);
      at(box(0.025, 0.12, 0.02, M.dark, false), parent, cx + dw * 0.32, 0.6, f + 0.008);          // handle
      for (let v = 0; v < 5; v++) at(box(dw * 0.42, 0.012, 0.004, M.dark, false), parent, cx - dw * 0.08, 0.26 + v * 0.035, f);
    }
  }
  // The upper enclosure: black frame, tinted glazing with a pass-through slot
  // at belt height, a lit interior and a blue trim line.
  function enclosure(parent, w, d, h) {
    const top = DECK + h;
    [1, -1].forEach(sx => [1, -1].forEach(sz => at(box(0.07, h, 0.07, M.black), parent, sx * (w / 2 - 0.035), DECK + h / 2, sz * (d / 2 - 0.035))));
    at(box(w, 0.1, d, M.black), parent, 0, top + 0.05, 0);
    at(box(w, 0.09, 0.07, M.black), parent, 0, DECK + 0.045, d / 2 - 0.035);        // front sill
    at(box(w, 0.09, 0.07, M.black), parent, 0, DECK + 0.045, -d / 2 + 0.035);
    at(box(w - 0.14, 0.03, 0.012, M.blue, false), parent, 0, DECK + 0.105, d / 2 + 0.002);
    const gh = h - 0.09;
    at(box(w - 0.14, gh, 0.012, M.glass, false), parent, 0, DECK + 0.09 + gh / 2, d / 2 - 0.03);
    at(box(w - 0.14, gh, 0.012, M.glass, false), parent, 0, DECK + 0.09 + gh / 2, -d / 2 + 0.03);
    const SLOT = 0.34;               // side glazing stops short so product passes under it
    [1, -1].forEach(sx => at(box(0.012, h - SLOT, d - 0.14, M.glass, false), parent, sx * (w / 2 - 0.03), DECK + SLOT + (h - SLOT) / 2, 0));
    at(box(w - 0.3, 0.025, 0.06, M.led, false), parent, 0, top - 0.02, d / 2 - 0.16);   // interior light
    at(box(w - 0.3, 0.025, 0.06, M.led, false), parent, 0, top - 0.02, -d / 2 + 0.16);
    return top + 0.1;
  }
  // A free-standing conveyor section between machines.
  function conveyor(x0, x1, z, width) {
    const len = x1 - x0, cx = (x0 + x1) / 2;
    at(box(len, 0.09, width + 0.1, M.alu), scene, cx, BELT_Y - 0.065, z);
    for (let x = x0 + 0.25; x < x1; x += 1.3) {
      [1, -1].forEach(s => at(box(0.05, BELT_Y - 0.11, 0.05, M.alu), scene, x, (BELT_Y - 0.11) / 2, z + s * (width / 2)));
    }
    [x0, x1].forEach(x => { const r = cyl(0.045, width + 0.06, M.dark, 14); r.rotation.x = HALF; at(r, scene, x, BELT_Y - 0.045, z); });
  }

  /* ── THE LINE ────────────────────────────────────────────────────── */
  const X_STACK = -8.45, X_GLUE = -6.9, X_BELT0 = -6.2, X_ROBOT = -1.5, X_FORM = 4.6, X_OUT = 11.0;
  const SHEET_W = 0.95, SHEET_D = 0.75, TRAY_W = 0.46, TRAY_D = 0.34, TRAY_H = 0.16, WALL = 0.014;

  // One continuous belt from the gluer to the stacker, plus the conveyor
  // frames that carry it between machines.
  at(box(X_OUT - X_BELT0 + 0.4, 0.02, 0.56, M.belt), scene, (X_BELT0 + X_OUT) / 2 + 0.1, BELT_Y - 0.01, 0).castShadow = false;
  conveyor(X_BELT0 - 0.1, -2.6, 0, 0.56);
  conveyor(-0.4, 3.3, 0, 0.56);
  conveyor(5.9, 10.3, 0, 0.56);

  // 1  Wrap feeder: a stack of printed wraps on an inclined table, with the
  //    indicator column the real machine carries on its side.
  const suction = (function () {
    const g = group(scene, -8.7, 0, 0);
    base(g, 1.7, 1.3, 2);
    at(box(0.22, 1.05, 1.15, M.white), g, -0.95, DECK + 0.3, 0);
    for (let i = 0; i < 6; i++) at(box(0.012, 0.05, 0.05, M.green, false), g, -1.065, DECK + 0.1 + i * 0.1, 0.35);
    at(box(0.3, 0.012, 0.3, M.blue, false), g, -1.064, DECK + 0.5, -0.2).rotation.z = HALF;
    const table = group(g, 0.1, DECK + 0.1, 0);
    table.rotation.z = -0.1;
    at(box(1.25, 0.04, 0.95, M.alu), table, 0, 0, 0);
    [0.42, -0.42].forEach(z => at(box(1.2, 0.2, 0.02, M.alu), table, 0, 0.1, z));
    const stackH = 0.2;
    for (let i = 0; i < 5; i++) at(box(SHEET_W, stackH / 5 - 0.004, SHEET_D, std(FINISHES[i], 0.5)), table, 0.05, 0.03 + (i + 0.5) * (stackH / 5), 0);
    const bar = at(box(0.7, 0.04, 0.06, M.dark), g, 0.25, DECK + 0.55, 0);            // suction head
    [0.25, 0, -0.25].forEach(x => at(cyl(0.025, 0.1, M.alu, 10), bar, x, -0.07, 0));
    [0.44, -0.44].forEach(z => at(box(0.05, 0.75, 0.05, M.alu), g, 0.25, DECK + 0.4, z));
    at(box(0.06, 0.05, 0.94, M.alu), g, 0.25, DECK + 0.76, 0);
    return bar;
  })();

  // 2  Gluer: a glue roller and a pressure roller under a stainless tank.
  const rollers = (function () {
    const g = group(scene, X_GLUE, 0, 0);
    base(g, 1.0, 1.2, 1);
    [0.5, -0.5].forEach(z => at(box(0.72, 0.52, 0.09, M.white), g, 0, DECK + 0.26, z));
    at(box(0.5, 0.2, 0.86, M.alu), g, 0, DECK + 0.6, 0);
    at(box(0.74, 0.03, 0.012, M.blue, false), g, 0, DECK + 0.44, 0.548);
    const list = [[0.0, 0.2, 0.085, M.dark], [-0.15, 0.31, 0.06, M.alu]].map(([x, y, r, mat]) => {
      const pivot = group(g, x, DECK + y, 0);
      const body = cyl(r, 0.9, mat, 28); body.rotation.x = HALF; pivot.add(body);
      for (let i = 0; i < 6; i++) {            // ribs, so the spin is visible
        const a = (i / 6) * Math.PI * 2;
        at(box(0.012, 0.012, 0.86, M.alu, false), pivot, Math.cos(a) * r, Math.sin(a) * r, 0);
      }
      return pivot;
    });
    stackLight(g, 0.3, DECK + 0.7, -0.35);
    return list;
  })();

  // 3  Positioning cell: cameras find the wrap, a SCARA robot sets the tray on it.
  const robot = (function () {
    const g = group(scene, X_ROBOT, 0, -0.35);
    base(g, 2.3, 1.9, 3);
    const roof = enclosure(g, 2.3, 1.9, 1.15);
    stackLight(g, 0.9, roof, -0.6);
    hmi(g, 1.0, 1.5, 1.2);
    // Vision: two cameras on a rail above the belt.
    at(box(1.3, 0.04, 0.04, M.alu), g, 0, DECK + 0.95, 0.35);
    [0.3, -0.3].forEach(x => {
      at(box(0.09, 0.12, 0.09, M.black), g, x, DECK + 0.87, 0.35);
      at(cyl(0.03, 0.05, M.dark, 14), g, x, DECK + 0.79, 0.35);
      at(box(0.1, 0.012, 0.1, M.blue, false), g, x, DECK + 0.762, 0.35);
    });
    // The arm: pedestal, two links and a vertical quill with a suction pad.
    const L1 = 0.42, L2 = 0.38;
    const bx = 0, bz = -0.37;
    at(cyl(0.085, 0.52, M.white, 20), g, bx, DECK + 0.26, bz);
    const shoulder = group(g, bx, DECK + 0.56, bz);
    at(cyl(0.075, 0.1, M.dark, 18), shoulder, 0, 0, 0);
    at(box(L1, 0.07, 0.12, M.white), shoulder, L1 / 2, 0, 0);
    const elbow = group(shoulder, L1, -0.065, 0);
    at(cyl(0.065, 0.09, M.dark, 18), elbow, 0, 0.03, 0);
    at(box(L2, 0.06, 0.1, M.white), elbow, L2 / 2, 0, 0);
    const quill = group(elbow, L2, 0, 0);
    at(cyl(0.022, 0.5, M.alu, 12), quill, 0, 0.25, 0);
    at(cyl(0.05, 0.02, M.dark, 14), quill, 0, 0.01, 0);
    at(box(0.12, 0.09, 0.09, M.dark), elbow, L2, 0.11, 0);
    // Reach a point (in the cell's frame) with two-link inverse kinematics.
    function reach(x, z, tipY) {
      const dx = x - bx, dz = z - bz, d = Math.min(Math.hypot(dx, dz), L1 + L2 - 0.001);
      const q2 = Math.acos(Math.max(-1, Math.min(1, (d * d - L1 * L1 - L2 * L2) / (2 * L1 * L2))));
      const q1 = Math.atan2(dz, dx) - Math.atan2(L2 * Math.sin(q2), L1 + L2 * Math.cos(q2));
      shoulder.rotation.y = -q1;
      elbow.rotation.y = -q2;
      quill.position.y = tipY - (DECK + 0.56 - 0.065);
    }
    return { cell: g, reach };
  })();
  // Where the robot picks and places, in world coordinates.
  const PICK = { x: X_ROBOT + 0.6, z: -1.05 }, PLACE = { x: X_ROBOT, z: 0 };
  const TIP_UP = BELT_Y + 0.42, TIP_DOWN = BELT_Y + 0.012 + TRAY_H;

  // 3b Corner pasting unit behind the cell: boards in, taped trays out.
  (function () {
    const g = group(scene, PICK.x, 0, -2.6);
    base(g, 1.15, 1.0, 1);
    [0.45, -0.45].forEach(x => at(box(0.06, 0.9, 0.06, M.black), g, x, DECK + 0.45, -0.4));
    at(box(0.96, 0.06, 0.06, M.black), g, 0, DECK + 0.9, -0.4);
    for (let i = 0; i < 9; i++) at(box(0.6, 0.016, 0.46, M.board), g, 0, DECK + 0.03 + i * 0.02, -0.12);   // board magazine
    [0.3, -0.3].forEach(x => { const r = cyl(0.11, 0.05, M.tape, 24); r.rotation.z = HALF; at(r, g, x, DECK + 0.72, -0.4); });
    at(box(0.36, 0.3, 0.3, M.white), g, 0, DECK + 0.15, 0.3);
    stackLight(g, -0.45, DECK + 0.93, -0.4);
    // Feed belt carrying trays into the cell.
    at(box(0.44, 0.02, 1.55, M.belt, false), scene, PICK.x, BELT_Y - 0.01, -1.4);
    at(box(0.52, 0.08, 1.5, M.alu), scene, PICK.x, BELT_Y - 0.06, -1.4);
  })();

  // 4  Forming station: a servo head wraps and presses the box.
  const former = (function () {
    const g = group(scene, X_FORM, 0, -0.2);
    base(g, 2.7, 2.1, 3);
    const roof = enclosure(g, 2.7, 2.1, 1.25);
    at(box(0.46, 0.5, 0.46, M.black), g, 0, roof + 0.25, 0.2);                 // servo drive on the roof
    at(cyl(0.09, 0.34, M.dark, 18), g, 0, roof + 0.67, 0.2);
    at(box(0.3, 0.16, 0.3, M.white), g, 0.5, roof + 0.08, 0.2);
    stackLight(g, -1.1, roof, -0.7);
    hmi(g, 1.15, 1.52, 1.3);
    const head = group(g, 0, 0, 0.2);
    at(box(0.5, 0.24, 0.38, M.black), head, 0, 0.12, 0);
    [0.17, -0.17].forEach(x => at(cyl(0.022, 1.0, M.alu, 12), head, x, 0.74, 0));
    const plates = [1, -1].map(s => at(box(0.56, 0.2, 0.02, M.alu), g, 0, DECK + 0.15, 0.2 + s * 0.42));
    return { head, plates };
  })();

  // 5  Stacker: finished boxes run into a covered outfeed.
  (function () {
    const g = group(scene, X_OUT + 0.75, 0, 0);
    base(g, 1.6, 1.4, 2);
    at(box(1.6, 0.75, 1.4, M.white), g, 0, DECK + 0.5 + 0.375, 0);
    [0.67, -0.67].forEach(z => at(box(1.6, 0.5, 0.06, M.white), g, 0, DECK + 0.25, z));
    at(box(0.03, 0.46, 1.26, M.black, false), g, -0.79, DECK + 0.25, 0);       // dark mouth
    at(box(1.3, 0.03, 0.012, M.blue, false), g, 0, DECK + 0.62, 0.702);
    stackLight(g, 0.55, DECK + 1.25, -0.45);
    hmi(g, 0.3, 1.5, 0.95);
  })();

  /* ── PRODUCT: a pool of boxes, each posed from its age ───────────── */
  const PERIOD = 3.2;              // seconds between boxes
  const POOL = 8;                  // boxes alive at once (life must stay under POOL × PERIOD)
  const T_PLACE = 4.95, T_FORM = 8.4, LIFE = 18.4;
  const boardColor = srgb(0xa39c90);

  function makeTray(mat) {
    const g = new THREE.Group();
    at(box(TRAY_W, WALL, TRAY_D, mat), g, 0, WALL / 2, 0);
    [1, -1].forEach(s => {
      at(box(TRAY_W, TRAY_H, WALL, mat), g, 0, TRAY_H / 2, s * (TRAY_D / 2 - WALL / 2));
      at(box(WALL, TRAY_H, TRAY_D, mat), g, s * (TRAY_W / 2 - WALL / 2), TRAY_H / 2, 0);
    });
    return g;
  }
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const sheetMat = std(FINISHES[0], 0.5), trayMat = std(0xa39c90, 0.9);
    const sheet = at(box(SHEET_W, 0.006, SHEET_D, sheetMat), scene, 0, 0, 0);
    const tray = makeTray(trayMat);
    scene.add(tray);
    pool.push({ sheet, tray, sheetMat, trayMat, finish: new THREE.Color() });
  }
  // The tray the robot is currently handling.
  const robotTray = makeTray(std(0xa39c90, 0.9));
  scene.add(robotTray);

  function poseBox(b, index, age) {
    if (index < 0 || age > LIFE) { b.sheet.visible = false; b.tray.visible = false; return; }
    b.finish.copy(srgb(FINISHES[index % FINISHES.length]));
    b.sheetMat.color.copy(b.finish);

    let x, y = BELT_Y + 0.004;
    if (age < 1.4) {                                   // off the stack, through the gluer
      const t = age / 1.4;
      x = lerp(X_STACK, X_BELT0, io(t));
      y = lerp(DECK + 0.36, BELT_Y + 0.004, io(clamp01(t * 1.7)));
    } else if (age < 4.4) {                            // to the robot
      const t = (age - 1.4) / 3.0;
      x = lerp(X_BELT0, X_ROBOT, t * (2 - t));
    } else if (age < 5.5) {                            // tray is placed
      x = X_ROBOT;
    } else if (age < T_FORM) {                         // to the forming station
      x = lerp(X_ROBOT, X_FORM, io((age - 5.5) / (T_FORM - 5.5)));
    } else if (age < 10.8) {                           // wrapped and pressed
      x = X_FORM;
    } else {                                           // out to the stacker
      const t = (age - 10.8) / (LIFE - 10.8);
      x = lerp(X_FORM, X_OUT + 0.25, t * t * (3 - 2 * t));
    }

    // The wrap folds up onto the tray inside the forming station.
    const wrap = seg(age, 9.0, 10.0);
    b.sheet.visible = wrap < 1;
    b.sheet.position.set(x, y, 0);
    b.sheet.scale.set(lerp(1, TRAY_W / SHEET_W, wrap), 1, lerp(1, TRAY_D / SHEET_D, wrap));

    b.tray.visible = age >= T_PLACE;
    b.tray.position.set(x, BELT_Y + 0.008, 0);
    b.trayMat.color.copy(boardColor).lerp(b.finish, wrap);
  }

  /* ── FINISHED STYLES: a display bench in front of the line ───────── */
  const styles = (function () {
    const g = group(scene, 4.2, 0, 4.2);
    at(box(4.6, 0.06, 0.95, M.white), g, 0, 0.78, 0);
    [2.1, -2.1].forEach(x => [0.36, -0.36].forEach(z => at(box(0.05, 0.75, 0.05, M.alu), g, x, 0.375, z)));
    at(box(4.6, 0.02, 0.012, M.blue, false), g, 0, 0.78, 0.478);
    const top = 0.81;
    const solid = (w, h, d, hex, x, y, z, parent) => at(box(w, h, d, std(hex, 0.5)), parent || g, x, y, z);

    // Lid and base
    solid(0.5, 0.16, 0.36, 0xf2ece0, -1.65, top + 0.08, 0);
    const lid = solid(0.52, 0.09, 0.38, 0xf2ece0, -1.65, top + 0.2, 0);
    at(box(0.2, 0.004, 0.05, M.gold, false), lid, 0, 0.047, 0);
    // Magnetic closure
    solid(0.5, 0.17, 0.36, 0x1b3252, -0.55, top + 0.085, 0);
    const flapHinge = group(g, -0.55, top + 0.175, -0.18);
    solid(0.5, 0.012, 0.36, 0x1b3252, 0, 0, 0.18, flapHinge);
    solid(0.5, 0.1, 0.012, 0x1b3252, 0, -0.05, 0.366, flapHinge);
    at(box(0.22, 0.004, 0.05, M.gold, false), flapHinge, 0, 0.008, 0.18);
    // Drawer
    const sleeve = group(g, 0.55, top, 0);
    solid(0.5, 0.012, 0.36, 0x7c1f2d, 0, 0.006, 0, sleeve);
    solid(0.5, 0.012, 0.36, 0x7c1f2d, 0, 0.164, 0, sleeve);
    [0.244, -0.244].forEach(x => solid(0.012, 0.17, 0.36, 0x7c1f2d, x, 0.085, 0, sleeve));
    const drawer = solid(0.46, 0.13, 0.34, 0xd29a2a, 0.55, top + 0.08, 0);
    // Shoulder neck
    solid(0.44, 0.13, 0.32, 0x23513f, 1.65, top + 0.065, 0);
    solid(0.4, 0.08, 0.28, 0xd29a2a, 1.65, top + 0.15, 0);
    const neckLid = solid(0.44, 0.1, 0.32, 0x23513f, 1.65, top + 0.24, 0);
    return { lid, flapHinge, drawer, neckLid, top };
  })();

  /* ── SUPERVISOR ──────────────────────────────────────────────────── */
  const operator = (function () {
    if (!window.LineOperator) return null;
    const f = LineOperator.build(scene, {
      uniform: M.navy, apron: M.gold, trousers: M.dark, shoe: M.shoe,
      skin: M.skin, hair: M.hair, eye: M.eye, mouth: M.mouth, accent: M.gold,
    });
    f.root.scale.setScalar(1.62 / 6.8);            // 1.62 m tall
    f.root.position.set(-4.3, 0, -1.45);          // behind the conveyor, facing the line and the viewer
    f.root.rotation.y = 0.25;
    // She watches the line from a tablet; she never handles the product.
    const tablet = at(box(1.15, 0.06, 0.8, M.black), f.upper, 0, 0.92, 1.3);
    tablet.rotation.x = 0.5;
    const glowPanel = at(box(1.0, 0.012, 0.66, glow(0x8fd6ff, 0.55), false), tablet, 0, 0.036, 0);
    glowPanel.castShadow = false;
    [f.left, f.right].forEach(arm => { arm.shoulder.rotation.x = -0.4; arm.elbow.rotation.x = -1.2; });
    f.left.shoulder.rotation.z = -0.12;
    f.right.shoulder.rotation.z = 0.12;
    return f;
  })();

  /* ── WALL HEADLINE ─────────────────────────────────────────────────
     With data-sign="headline" the page's headline is lettered on the back
     wall, like signage. It belongs to the room: the machines stand in front
     of it and the camera holds still, so it stays exactly where it is while
     the line runs and the supervisor walks. The page hides its own copy of
     the headline once this one is showing. */
  const FIXED = stage.getAttribute('data-sign') === 'headline';
  // Where the still camera stands. On a wide screen it stands back far enough to show the whole line,
  // feeder to stacker, and high enough that no machine reaches up in front of the lettering. A tall
  // narrow screen cannot hold the whole line, so it stands closer, on the robot cell.
  function stillView() {
    const a = camera.aspect;
    if (a < 1) return { x: 0.64, y: 2.3, z: 11.6 + 3.0 * clamp01((2.2 / a - 1) / 1.2), ax: 0, ay: 1.6 };
    const z = Math.min(21, Math.max(11.6, 23.4 / (2 * Math.tan(camera.fov * Math.PI / 360) * a)));
    return { x: 1.25, y: 3.0, z, ax: 1.25, ay: 1.9 };
  }
  const headline = FIXED ? (function () {
    const text = stage.getAttribute('data-headline') || '';
    const cv = document.createElement('canvas'), tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    scene.add(mesh);
    const FONT = '600 150px Montserrat, Arial, sans-serif', LINE = 178;
    // Draw the words on one line, or on two broken as evenly as the words allow. Returns width ÷ height.
    function draw(twoLines) {
      const c = cv.getContext('2d'), words = text.split(' ');
      c.font = FONT;
      let lines = [text];
      if (twoLines && words.length > 1) {
        let best = Infinity;
        for (let i = 1; i < words.length; i++) {
          const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
          const widest = Math.max(c.measureText(a).width, c.measureText(b).width);
          if (widest < best) { best = widest; lines = [a, b]; }
        }
      }
      const w = Math.ceil(Math.max.apply(null, lines.map(l => c.measureText(l).width))) + 40, h = lines.length * LINE + 30;
      cv.width = w; cv.height = h;                       // resizing clears the canvas and its settings
      c.font = FONT; c.fillStyle = '#101a2c'; c.textAlign = 'center'; c.textBaseline = 'middle';
      lines.forEach((l, i) => c.fillText(l, w / 2, 15 + LINE / 2 + i * LINE));
      tex.needsUpdate = true;
      return w / h;
    }
    return { mesh, draw };
  })() : null;
  // Size the lettering to the wall the camera can see, and centre it on the camera's line of sight.
  function placeHeadline() {
    if (!headline) return;
    const v = stillView(), dist = v.z - BACK_Z, tall = camera.aspect < 1;
    const seen = 2 * dist * Math.tan(camera.fov * Math.PI / 360) * camera.aspect;     // width of wall in view
    const ratio = headline.draw(tall);                  // two lines on a tall screen, one otherwise
    const width = tall ? Math.min(seen * 0.8, 12.5) : Math.min(seen * 0.4, 13.2);   // small enough to clear the duct above and the tower below
    headline.mesh.scale.set(width, width / ratio, 1);
    // Between the duct and the machine tops, on the camera's line of sight.
    headline.mesh.position.set(v.x + (v.ax - v.x) * dist / v.z, tall ? 3.12 : 3.47, BACK_Z + 0.03);
  }
  if (headline && document.fonts && document.fonts.load) {
    document.fonts.load('600 150px Montserrat').then(() => { placeHeadline(); kick(); }).catch(() => {});
  }

  /* ── FRAME ───────────────────────────────────────────────────────── */
  const aim = new THREE.Vector3();
  function pose(time) {
    // Boxes: slot s holds the newest box whose index ≡ s (mod POOL).
    const head = time / PERIOD;
    pool.forEach((b, s) => {
      const index = Math.floor((head - s) / POOL) * POOL + s;
      poseBox(b, index, time - index * PERIOD);
    });

    // Feeder: the suction head dips once per sheet; rollers turn with the belt.
    const feed = (time % PERIOD) / PERIOD;
    suction.position.y = DECK + 0.55 - 0.1 * Math.sin(Math.PI * seg(feed, 0.0, 0.3));
    rollers[0].rotation.z = -time * 5;
    rollers[1].rotation.z = time * 7;

    // Robot: one pick-and-place per box. phase 0 is the instant the tray lands.
    const ph = (((time - T_PLACE) / PERIOD) % 1 + 1) % 1;
    const k = ph < 0.5 ? 1 - io(seg(ph, 0.12, 0.40)) : io(seg(ph, 0.60, 0.88));   // 0 at pick, 1 at place
    const dip = ph < 0.12 ? 1 - io(ph / 0.12)
      : ph < 0.40 ? 0
      : ph < 0.50 ? io(seg(ph, 0.40, 0.48))
      : ph < 0.60 ? 1 - io(seg(ph, 0.50, 0.60))
      : ph < 0.88 ? 0 : io(seg(ph, 0.88, 1));
    const tipY = lerp(TIP_UP, TIP_DOWN, dip);
    const tx = lerp(PICK.x, PLACE.x, k), tz = lerp(PICK.z, PLACE.z, k);
    robot.reach(tx - X_ROBOT, tz + 0.35, tipY);       // the cell sits at z = −0.35
    if (ph >= 0.5) {                               // carried under the suction pad
      robotTray.visible = true;
      robotTray.position.set(tx, tipY - TRAY_H, tz);
    } else if (ph >= 0.02) {                       // arriving from the corner paster
      robotTray.visible = true;
      robotTray.position.set(PICK.x, BELT_Y + 0.008, lerp(-2.05, PICK.z, io(seg(ph, 0.02, 0.36))));
    } else {
      robotTray.visible = false;
    }

    // Forming head and folding plates close on each box as it arrives.
    const fs = (((time - T_FORM) % PERIOD) + PERIOD) % PERIOD;
    const press = io(seg(fs, 0.3, 0.9)) - io(seg(fs, 1.7, 2.3));
    former.head.position.y = lerp(DECK + 0.72, BELT_Y + 0.012 + TRAY_H, press);
    former.plates.forEach((p, i) => { p.position.z = 0.2 + (i ? -1 : 1) * lerp(0.42, TRAY_D / 2 + 0.02, press); });

    // Display bench: lids lift, the drawer slides.
    const s1 = 0.5 - 0.5 * Math.cos(time * 0.9), s2 = 0.5 - 0.5 * Math.cos(time * 0.9 + 1.6);
    styles.lid.position.y = styles.top + 0.2 + 0.16 * s1;
    styles.flapHinge.rotation.x = -1.0 * s2;
    styles.drawer.position.z = 0.26 * s1;
    styles.neckLid.position.y = styles.top + 0.24 + 0.15 * s2;

    // Supervisor: breathes, taps the tablet, glances up at the line.
    if (operator) {
      const look = 0.5 - 0.5 * Math.cos(time * 0.45);
      operator.upper.rotation.x = 0.03 + 0.012 * Math.sin(time * 1.7);
      operator.head.rotation.x = lerp(0.42, -0.02, io(seg(look, 0.55, 0.85)));
      operator.head.rotation.y = lerp(0, 0.75, io(seg(look, 0.55, 0.85)));
      operator.right.elbow.rotation.x = -1.2 + 0.1 * Math.max(0, Math.sin(time * 5)) * (look < 0.5 ? 1 : 0);
      operator.pony.rotation.x = 0.16 + 0.05 * Math.sin(time * 1.3);
      if (FIXED) {
        // She walks the length of the line behind the machines, pausing at each end to check her tablet.
        const lap = (time * 0.028) % 1;
        const x = lerp(-8.2, 9.2, io(seg(lap, 0.04, 0.46)) - io(seg(lap, 0.54, 0.96)));
        const going = Math.sin(Math.PI * seg(lap, 0.04, 0.46)) - Math.sin(Math.PI * seg(lap, 0.54, 0.96));   // +1 out, −1 back, 0 standing
        const pace = Math.min(1, Math.abs(going) * 2.2);
        operator.root.position.set(x, 0, -2.5);
        operator.root.rotation.y = lerp(0.25, (going < 0 ? -1 : 1) * 1.35, pace);
        const stride = 0.5 * pace * Math.sin(x * 3.4);
        operator.legs[0].rotation.x = stride;
        operator.legs[1].rotation.x = -stride;
      }
    }

    // Camera: still when the headline is lettered on the wall; otherwise a slow pan along the line.
    // Narrow screens pan further and sit closer in.
    if (FIXED) {
      const v = stillView();
      aim.set(v.ax, v.ay, 0);
      camera.position.set(v.x, v.y, v.z);
    } else {
      const narrow = clamp01((2.2 / camera.aspect - 1) / 1.2);
      const pan = (3.2 + 3.6 * narrow) * Math.sin(time * 0.1);
      aim.set(1.2 + pan, 1.6, 0);
      camera.position.set(1.6 + pan * 0.8, 2.3, 11.6 + 3.0 * narrow);
    }
    camera.lookAt(aim);
  }

  /* ── LOOP ────────────────────────────────────────────────────────── */
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const WARM_UP = 40;              // start with the line already full
  let clock = WARM_UP, last = 0, raf = 0, onScreen = true;

  function frame(now) {
    raf = 0;
    if (last) clock += Math.min((now - last) / 1000, 0.1);   // cap, so a background tab doesn't jump the line
    last = now;
    pose(clock);
    renderer.render(scene, camera);
    if (onScreen && !reduceMotion && !document.hidden) raf = requestAnimationFrame(frame);
    else last = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    placeHeadline();
    kick();
  }
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  if (window.IntersectionObserver) {
    new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }).observe(stage);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  resize();
  stage.classList.add('autoline-ready');
})();
