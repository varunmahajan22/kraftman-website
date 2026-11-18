/* ═══════════════════════════════════════════════════════════════════
   Drawer (slide) rigid box — scroll-driven construction

   A tray with a ribbon pull, and a sleeve: four boards on one wrap —
   floor, wall, roof, wall — folded round into a tube the tray slides
   into.
   Renderer, kit and scroll loop live in box-story-core.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.BoxStory && BoxStory.create();
  if (!S) return;
  const { scene, srgb } = S;
  const { seg, io, out, lerp } = BoxStory.ease;
  const HALF = Math.PI / 2;

  /* ── DIMENSIONS ──────────────────────────────────────────────────── */
  const W = 3, D = 2, H = 0.95;    // the drawer tray; it slides along z
  const T = 0.06, E = 0.012, C = 0.008;
  const G = 2 * T + 0.01;          // hinge gap between sleeve boards (≥ 2T or they collide)

  const M = S.materials({ paper: 0x7c1f2d });
  const K = S.kit({ T, E, strip: 0.22, board: M.board, paper: M.paper, lining: M.lining, tape: M.tape, groove: M.groove });

  /* ── TRAY ────────────────────────────────────────────────────────── */
  const tray = K.tray({ W, D, H });
  scene.add(tray.root);
  // Ribbon pull on the front wall.
  const ribbon = new THREE.Mesh(
    new THREE.TorusGeometry(0.13, 0.02, 8, 24, Math.PI),
    new THREE.MeshStandardMaterial({ color: srgb(0xd29a2a), roughness: 0.5 })
  );
  ribbon.rotation.z = Math.PI;
  ribbon.position.set(0, T / 2 + H * 0.62, D / 2 + T / 2 + E + 0.012);
  ribbon.castShadow = true;
  tray.root.add(ribbon);

  /* ── SLEEVE ──────────────────────────────────────────────────────── */
  // Sized so the lined inside clears the wrapped tray on every side.
  const WS = tray.outerW + 2 * (C + T + 2 * E) - G;        // floor / roof board width
  const HS = E + tray.top + C + 2 * T + 4 * E - G;         // wall board height
  const DS = tray.outerD;                                  // sleeve depth
  const FLAT_CENTRE = (3 * G + 2 * HS + WS) / 2;           // centre of the flat layout, from the floor's centre
  const TRAY_SEAT = E + T + 3 * E + 0.002;                 // tray origin height when inside the sleeve
  const PARK_Z = 3.7;                                      // where the finished tray waits

  const sleeve = K.group(scene, 0, E, 0);
  const h1 = K.group(sleeve, WS / 2 + G / 2, 0, 0);        // floor ↔ wall
  const h2 = K.group(h1, HS + G, 0, 0);                    // wall ↔ roof
  const h3 = K.group(h2, WS + G, 0, 0);                    // roof ↔ wall
  const g2 = G / 2, deep = { z0: -DS / 2, z1: DS / 2 };
  const panels = [
    K.panel(sleeve, Object.assign({ x0: -WS / 2, x1: WS / 2 }, deep), { free: 'x- z+ z-', ext: { xp: g2 } }),
    K.panel(h1, Object.assign({ x0: g2, x1: g2 + HS }, deep), { free: 'z+ z-', ext: { xm: g2, xp: g2 } }),
    K.panel(h2, Object.assign({ x0: g2, x1: g2 + WS }, deep), { free: 'z+ z-', ext: { xm: g2, xp: g2 } }),
    K.panel(h3, Object.assign({ x0: g2, x1: g2 + HS }, deep), { free: 'x+ z+ z-', ext: { xm: g2 } }),
  ];

  // Logo on the outside of the roof. Flat, it faces the table; folded
  // over, it reads from the front.
  const logo = S.lidLogo(1.9);
  logo.position.set(g2 + WS / 2, -E - 0.002, 0);
  logo.rotation.order = 'YXZ';
  logo.rotation.set(HALF, Math.PI, 0);
  h2.add(logo);

  const poseCamera = S.cameraPath([
    [0.00, [0.0, 10.5, 4.5],   [0.0, 0.0, 0.2]],
    [0.14, [5.0, 5.5, 7.6],    [0.0, 0.4, 0.0]],
    [0.34, [5.4, 4.8, 7.0],    [0.0, 0.5, 0.0]],
    [0.42, [3.0, 14.5, 12.0],  [0.0, 0.0, 1.0]],
    [0.58, [4.0, 13.0, 11.5],  [0.0, 0.2, 1.0]],
    [0.78, [6.5, 7.0, 11.5],   [0.0, 0.6, 1.4]],
    [0.90, [6.5, 5.0, 9.0],    [0.0, 0.6, 0.6]],
    [0.975, [5.2, 3.6, 7.4],   [0.0, 0.55, 0.5]],
    [1.00, [3.4, 3.2, 8.0],    [0.0, 0.55, 0.5]],
  ]);

  const STEPS = [0, 0.14, 0.34, 0.58, 0.78, 1.0001];

  function apply(p) {
    // 1  Tray blank folds up and is corner-stayed
    tray.fold(io(seg(p, 0.035, 0.09)), io(seg(p, 0.07, 0.125)));
    tray.stay(out(seg(p, 0.12, 0.14)));

    // 2  Tray wrapped, turned in and lined; the ribbon goes on
    tray.core.position.y = 0.7 * (io(seg(p, 0.15, 0.175)) - io(seg(p, 0.21, 0.235)));
    tray.wrap.visible = p > 0.16;
    tray.wrap.position.x = -12 * (1 - out(seg(p, 0.16, 0.21)));
    tray.wrapFold(io(seg(p, 0.235, 0.27)), io(seg(p, 0.25, 0.285)), io(seg(p, 0.285, 0.30)), io(seg(p, 0.298, 0.315)));
    tray.line(seg(p, 0.305, 0.335));
    const rb = out(seg(p, 0.315, 0.34));
    ribbon.visible = rb > 0;
    ribbon.scale.setScalar(Math.max(rb, 0.001));

    // 3  Sleeve: wrap slides in, four boards land on it, edges turn in, lining goes on
    sleeve.visible = p > 0.37;
    panels.forEach((pn, i) => pn.dropBoard(seg(p, 0.42 + 0.012 * i, 0.455 + 0.012 * i)));
    const cap = io(seg(p, 0.495, 0.512)), strip = io(seg(p, 0.508, 0.528));
    panels.forEach(pn => pn.turnIn(cap, strip));
    panels.forEach((pn, i) => pn.dropLiner(seg(p, 0.53 + 0.01 * i, 0.56 + 0.01 * i)));

    // 4  Wall, roof, wall: the sleeve folds round into a tube
    h1.rotation.z = HALF * io(seg(p, 0.60, 0.655));
    h2.rotation.z = HALF * io(seg(p, 0.645, 0.705));
    h3.rotation.z = HALF * io(seg(p, 0.695, 0.755));
    const centred = 1 - io(seg(p, 0.60, 0.73));          // flat: centred on the layout; folded: on the floor
    sleeve.position.x = -FLAT_CENTRE * centred - 14 * (1 - out(seg(p, 0.37, 0.42)));

    // 5  The finished tray, parked in front, slides home — then out again on its ribbon
    const park = io(seg(p, 0.345, 0.385));
    const slideIn = io(seg(p, 0.82, 0.90)), slideOut = io(seg(p, 0.925, 0.975));
    tray.root.position.set(
      0,
      lerp(E, TRAY_SEAT, io(seg(p, 0.79, 0.815))),
      PARK_Z * park - PARK_Z * slideIn + 1.05 * slideOut
    );
    logo.material.emissiveIntensity = 0.3 + 0.55 * Math.sin(Math.PI * seg(p, 0.92, 1));

    poseCamera(p);
  }

  S.start({ steps: STEPS, apply });
})();
