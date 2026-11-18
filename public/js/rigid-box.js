/* ═══════════════════════════════════════════════════════════════════
   Magnetic / book-style rigid box — scroll-driven construction

   A wrapped tray glued into a wrap-around case (base → spine → lid →
   flap) that closes on hidden magnets. Everything is a pure function of
   scroll progress p (0 → 1), so scrubbing backwards un-builds the box.
   Renderer, kit and scroll loop live in box-story-core.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.BoxStory && BoxStory.create();
  if (!S) return;
  const { scene, setOpacity } = S;
  const { clamp01, seg, io, out, inn, lerp } = BoxStory.ease;
  const HALF = Math.PI / 2;

  /* ── DIMENSIONS (scene units; the tray is 3 × 2 × 1) ─────────────── */
  const W = 3, D = 2, H = 1;       // tray footprint and wall height
  const T = 0.06;                  // greyboard thickness
  const E = 0.012;                 // paper thickness
  const C = 0.004;                 // clearance between mating surfaces
  const G = 2 * T + 0.01;          // hinge gap between case boards (≥ 2T or they collide)
  const LF = 0.62;                 // flap length

  // Derived so the closed box actually closes: the lid lining lands on the
  // tray rim and the flap lining lands on the wrapped front wall.
  const MZ = 1.5 * T + 3 * E + C - G / 2;          // case overhang, front and back
  const MX = 0.05;                                 // case overhang, each side
  const WC = W + T + 2 * E + 2 * MX;               // case width
  const DC = D + 2 * MZ;                           // base / lid board length
  const LS = H + 2.5 * T + 6 * E + C - G;          // spine board length
  const LAND_Y = T + 4 * E;                        // tray height once seated on the case
  const MAG_X = 0.7;                               // magnets sit at x = ±MAG_X
  const MAG_Y = T / 2 + H * 0.74;                  // magnet height on the tray wall
  const PARK_X = 3.9;                              // where the tray waits during case making

  const M = S.materials();
  const K = S.kit({ T, E, strip: 0.22, board: M.board, paper: M.paper, lining: M.lining, tape: M.tape, groove: M.groove });

  /* ── TRAY ────────────────────────────────────────────────────────── */
  const tray = K.tray({ W, D, H });
  scene.add(tray.root);

  // Magnets seated in the front wall, half-recessed so the wrap hides them.
  const magGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.016, 40);
  const wallMagMat = M.magnet.clone();
  const wallMags = [-1, 1].map(s => {
    const m = new THREE.Mesh(magGeo, wallMagMat);
    m.rotation.x = HALF;
    m.userData.home = new THREE.Vector3(s * MAG_X, MAG_Y, D / 2 + T / 2);
    tray.core.add(m);
    return m;
  });

  /* ── CASE (the wrap-around cover: base → spine → lid → flap) ─────── */
  const cg = K.group(scene, 0, E, 0);
  const h1 = K.group(cg, 0, 0, -DC / 2 - G / 2);       // base ↔ spine
  const h2 = K.group(h1, 0, 0, -(LS + G));             // spine ↔ lid
  const h3 = K.group(h2, 0, 0, -(DC + G));             // lid ↔ flap

  const g2 = G / 2, wide = { x0: -WC / 2, x1: WC / 2 };
  const panels = [
    K.panel(cg, Object.assign({ z0: -DC / 2, z1: DC / 2 }, wide), { free: 'x+ x- z+', ext: { zm: g2 } }),          // base
    K.panel(h1, Object.assign({ z0: -g2 - LS, z1: -g2 }, wide), { free: 'x+ x-', ext: { zm: g2, zp: g2 } }),      // spine
    K.panel(h2, Object.assign({ z0: -g2 - DC, z1: -g2 }, wide), { free: 'x+ x-', ext: { zm: g2, zp: g2 } }),      // lid
    K.panel(h3, Object.assign({ z0: -g2 - LF, z1: -g2 }, wide), { free: 'x+ x- z-', ext: { zp: g2 } }),           // flap
  ];

  // Flap magnets, placed so they meet the wall magnets when the box is shut.
  const flapMagMat = M.magnet.clone();
  const flapMagZ = LAND_Y + MAG_Y - (E + LS + G);
  const flapMags = [-1, 1].map(s => {
    const m = new THREE.Mesh(magGeo, flapMagMat);
    m.userData.home = new THREE.Vector3(s * MAG_X, T, flapMagZ);
    h3.add(m);
    return m;
  });

  // Logo on the outside of the lid. While the case lies flat it faces
  // the table; it only comes into view as the lid folds over.
  const logo = S.lidLogo(1.9);
  logo.position.set(0, -E - 0.002, -g2 - DC / 2);
  logo.rotation.x = HALF;
  h2.add(logo);

  /* ── CAMERA PATH ─────────────────────────────────────────────────── */
  const poseCamera = S.cameraPath([
    // p,    position,            look-at
    [0.00, [0.0, 10.5, 4.5],  [0.0, 0.0, 0.2]],
    [0.10, [5.0, 6.5, 7.5],   [0.0, 0.3, 0.0]],
    [0.20, [4.6, 4.6, 7.6],   [0.0, 0.5, 0.0]],
    [0.26, [2.6, 3.4, 8.2],   [0.0, 0.6, 0.2]],
    [0.31, [5.2, 6.0, 7.8],   [0.0, 0.3, 0.0]],
    [0.46, [5.6, 4.6, 6.6],   [0.0, 0.5, 0.0]],
    [0.54, [10.5, 12.0, 8.5], [1.6, 0.0, -1.7]],
    [0.62, [9.5, 10.5, 3.5],  [1.3, 0.0, -2.7]],
    [0.67, [10.5, 12.0, 8.5], [1.6, 0.0, -1.7]],
    [0.76, [10.5, 11.5, 9.0], [1.6, 0.3, -1.5]],
    [0.84, [8.0, 7.5, 8.5],   [0.0, 0.6, -1.6]],
    [0.90, [7.0, 6.0, 8.5],   [0.0, 0.9, -0.6]],
    [0.96, [5.0, 3.8, 7.0],   [0.0, 0.6, 0.0]],
    [1.00, [-3.6, 3.4, 7.4],  [0.0, 0.6, 0.0]],
  ]);

  /* ── TIMELINE ────────────────────────────────────────────────────── */
  // Where each caption step begins; the last entry closes the final step.
  const STEPS = [0, 0.10, 0.22, 0.30, 0.48, 0.66, 0.76, 0.84, 1.0001];

  function apply(p) {
    // 1–2  Blank → erected tray
    tray.fold(io(seg(p, 0.10, 0.165)), io(seg(p, 0.14, 0.20)));
    tray.stay(out(seg(p, 0.195, 0.225)));

    // 3  Magnets fly into the front wall
    const mg = seg(p, 0.235, 0.29), mgE = out(mg);
    wallMags.forEach(m => {
      m.position.copy(m.userData.home);
      m.position.y += 0.6 * (1 - mgE);
      m.position.z += 2.4 * (1 - mgE);
      setOpacity(m, clamp01(mg * 3));
    });

    // 4  Tray lifts, wrap slides under, tray is spotted, paper folds up and in
    tray.core.position.y = 0.7 * (io(seg(p, 0.30, 0.33)) - io(seg(p, 0.36, 0.39)));
    tray.wrap.visible = p > 0.31;
    tray.wrap.position.x = -12 * (1 - out(seg(p, 0.31, 0.365)));
    tray.wrapFold(io(seg(p, 0.39, 0.425)), io(seg(p, 0.405, 0.44)), io(seg(p, 0.44, 0.462)), io(seg(p, 0.458, 0.48)));

    // 5  Tray parks aside; case wrap slides in; boards and flap magnets drop; turn-in
    cg.visible = p > 0.5;
    cg.position.x = -13 * (1 - out(seg(p, 0.50, 0.555)));
    panels.forEach((pn, i) => pn.dropBoard(seg(p, 0.545 + 0.012 * i, 0.58 + 0.012 * i)));
    const fm = seg(p, 0.605, 0.635), fmE = out(fm);
    flapMags.forEach(m => {
      m.position.copy(m.userData.home);
      m.position.y += 1.2 * (1 - fmE);
      setOpacity(m, clamp01(fm * 3));
    });
    const cap = io(seg(p, 0.635, 0.65)), strip = io(seg(p, 0.648, 0.665));
    panels.forEach(pn => pn.turnIn(cap, strip));

    // 6  Lining
    panels.forEach((pn, i) => pn.dropLiner(seg(p, 0.668 + 0.012 * i, 0.70 + 0.012 * i)));
    tray.line(seg(p, 0.705, 0.75));

    // 5 + 7  Tray parks beside the case, then hops across and seats on the base
    const park = io(seg(p, 0.48, 0.525)) - io(seg(p, 0.775, 0.815));
    const hop  = io(seg(p, 0.76, 0.785)) - io(seg(p, 0.81, 0.84));
    const seat = io(seg(p, 0.81, 0.84));
    tray.root.position.set(PARK_X * park, lerp(E, LAND_Y, seat) + 1.9 * hop, 0);

    // 8  Spine up, lid over, flap pulled shut by the magnets
    h1.rotation.x = HALF * io(seg(p, 0.85, 0.90));
    h2.rotation.x = HALF * io(seg(p, 0.875, 0.93));
    h3.rotation.x = HALF * inn(seg(p, 0.925, 0.958));
    logo.material.emissiveIntensity = 0.3 + 0.55 * Math.sin(Math.PI * seg(p, 0.94, 1));

    poseCamera(p);
  }

  S.start({ steps: STEPS, apply });
})();
