/* ═══════════════════════════════════════════════════════════════════
   Collapsible rigid box — scroll-driven construction

   One wrap carrying every board — base, four walls, lid, flap and four
   corner ears — with a hinge gap between each. It ships flat. To erect
   it the ears fold in, the walls lift, the ears stick to adhesive strips
   on the front and back walls, and magnets hold the lid shut.
   Renderer, kit and scroll loop live in box-story-core.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.BoxStory && BoxStory.create();
  if (!S) return;
  const { scene, box, setOpacity, srgb } = S;
  const { clamp01, seg, io, out, inn, lerp } = BoxStory.ease;
  const HALF = Math.PI / 2;

  /* ── DIMENSIONS (the erected box is 3 × 2 × 1) ───────────────────── */
  const W = 3, D = 2, H = 1;
  const T = 0.06;                  // greyboard thickness
  const E = 0.012;                 // paper thickness
  const C = 0.006;                 // clearance between mating surfaces
  const G = 2 * T + 0.01;          // hinge gap between boards (≥ 2T or they collide when folded)
  const HBL = H + 0.05;            // back wall is a touch taller so the lid clears the rim
  const DL  = D + T + 3 * E + C;   // lid length: the flap must land on the front wall
  const LF  = 0.62;                // flap length
  const LE  = 0.55;                // corner ear length
  const WFB = W + G;               // front / back wall width (out to the side walls' outer face)
  const WL  = W + G + 0.06;        // lid and flap width
  const DS  = D - 2 * T - 6 * E - 2 * C;   // side wall length: ears land on the lined front/back walls
  const MAG_X = 0.7;
  // Offset that centres the flat blank on its root.
  const BODY_OFF = ((D / 2 + G + HBL + G + DL + G + LF) - (D / 2 + G + H)) / 2;

  const M = S.materials();
  const K = S.kit({ T, E, strip: 0.16, board: M.board, paper: M.paper, lining: M.lining, tape: M.tape, groove: M.groove });

  /* ── THE BLANK ───────────────────────────────────────────────────── */
  // Laid with its long axis across the view; the erected box turns to face the camera.
  const root = K.group(scene, 0, E, 0);
  root.rotation.y = HALF;
  const body = K.group(root);                // slides the blank so it is centred while flat

  // Hinges. Each is a pivot on the wrap's surface, centred in its gap.
  const hF  = K.group(body, 0, 0, D / 2 + G / 2);            // base ↔ front wall
  const hB  = K.group(body, 0, 0, -(D / 2 + G / 2));         // base ↔ back wall
  const hL  = K.group(hB, 0, 0, -(HBL + G));                 // back wall ↔ lid
  const hFl = K.group(hL, 0, 0, -(DL + G));                  // lid ↔ flap
  const hR  = K.group(body, W / 2 + G / 2, 0, 0);            // base ↔ right wall
  const hLt = K.group(body, -(W / 2 + G / 2), 0, 0);         // base ↔ left wall

  const g2 = G / 2;
  const panels = [                           // in the order the boards are placed
    K.panel(body, { x0: -W / 2, x1: W / 2, z0: -D / 2, z1: D / 2 }, { ext: { xm: g2, xp: g2, zm: g2, zp: g2 } }),
    K.panel(hB,  { x0: -WFB / 2, x1: WFB / 2, z0: -g2 - HBL, z1: -g2 }, { free: 'x+ x-', ext: { zm: g2, zp: g2 } }),
    K.panel(hL,  { x0: -WL / 2, x1: WL / 2, z0: -g2 - DL, z1: -g2 }, { free: 'x+ x-', ext: { zm: g2, zp: g2 } }),
    K.panel(hFl, { x0: -WL / 2, x1: WL / 2, z0: -g2 - LF, z1: -g2 }, { free: 'x+ x- z-', ext: { zp: g2 } }),
    K.panel(hF,  { x0: -WFB / 2, x1: WFB / 2, z0: g2, z1: g2 + H }, { free: 'x+ x- z+', ext: { zm: g2 } }),
    K.panel(hR,  { x0: g2, x1: g2 + H, z0: -DS / 2, z1: DS / 2 }, { free: 'x+', ext: { xm: g2, zm: g2, zp: g2 } }),
    K.panel(hLt, { x0: -g2 - H, x1: -g2, z0: -DS / 2, z1: DS / 2 }, { free: 'x-', ext: { xp: g2, zm: g2, zp: g2 } }),
  ];

  // Corner ears: hinged off both ends of each side wall. They fold in first,
  // then ride up inside the front and back walls as the side walls lift.
  const ears = [];
  [[hR, 1], [hLt, -1]].forEach(([wallHinge, side]) => {
    const xa = side > 0 ? g2 + 0.06 : -g2 - H + 0.06;
    const xb = side > 0 ? g2 + H - 0.06 : -g2 - 0.06;
    [1, -1].forEach(end => {
      const pivot = K.group(wallHinge, 0, 0, end * (DS / 2 + g2));
      const r = end > 0 ? { x0: xa, x1: xb, z0: g2, z1: g2 + LE } : { x0: xa, x1: xb, z0: -g2 - LE, z1: -g2 };
      panels.push(K.panel(pivot, r, { free: 'x+ x- ' + (end > 0 ? 'z+' : 'z-'), ext: end > 0 ? { zm: g2 } : { zp: g2 } }));
      ears.push({ pivot, end });
    });
  });

  // Peel-off strips where the ears will land.
  const tapeMat = new THREE.MeshStandardMaterial({ color: srgb(0xf6f1e7), roughness: 0.5 });
  const tapes = [];
  [[hF, g2 + H / 2], [hB, -g2 - HBL / 2]].forEach(([hinge, z]) => {
    [1, -1].forEach(s => {
      const t = box(LE - 0.14, 0.004, 0.5, tapeMat);
      t.position.set(s * (W / 2 - LE / 2 - 0.02), T + 2 * E + 0.002, z);
      t.castShadow = false;
      hinge.add(t);
      tapes.push(t);
    });
  });

  // Magnets: flap and front wall, at heights that meet when the lid is shut.
  const magGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.016, 40);
  const flapMagD = g2 + LF / 2;
  const magnets = [];
  [[hFl, -flapMagD], [hF, HBL + G - flapMagD]].forEach(([hinge, z]) => {
    [-1, 1].forEach(s => {
      const m = new THREE.Mesh(magGeo, M.magnet.clone());
      m.userData.home = new THREE.Vector3(s * MAG_X, T, z);
      hinge.add(m);
      magnets.push(m);
    });
  });

  // Logo on the outside of the lid; faces the table until the lid folds over.
  const logo = S.lidLogo(1.9);
  logo.position.set(0, -E - 0.002, -g2 - DL / 2);
  logo.rotation.x = HALF;
  hL.add(logo);

  // "Ships flat": three more finished blanks that stack under this one. Each
  // is a simplified copy — one slab per board, in the lining colour on top.
  body.position.z = BODY_OFF;
  scene.updateMatrixWorld(true);
  const FLAT_H = T + 2 * E;
  const stack = [0, 1, 2].map(() => {
    const g = K.group(scene);
    const at = new THREE.Vector3();
    panels.forEach(pn => {
      const size = pn.board.geometry.parameters;
      pn.board.getWorldPosition(at);
      // The blank is turned a quarter, so a board's width runs along world z.
      const slab = box(size.depth, FLAT_H, size.width, M.paper);
      slab.position.set(at.x, FLAT_H / 2, at.z);
      const top = box(size.depth - 0.12, 0.004, size.width - 0.12, M.lining);
      top.position.set(at.x, FLAT_H + 0.002, at.z);
      top.castShadow = false;
      g.add(slab, top);
    });
    return g;
  });

  const poseCamera = S.cameraPath([
    [0.00, [0.0, 17.0, 5.0],   [0.0, 0.0, 0.0]],
    [0.22, [2.0, 13.5, 9.5],   [0.0, 0.0, 0.0]],
    [0.30, [-3.6, 7.0, 7.0],   [-2.4, 0.0, 0.2]],
    [0.42, [3.0, 12.5, 10.0],  [0.0, 0.0, 0.0]],
    [0.58, [3.5, 10.5, 11.5],  [0.0, 0.1, 0.0]],
    [0.66, [6.5, 5.5, 12.0],   [0.0, 0.3, 0.0]],
    [0.74, [5.0, 8.5, 11.0],   [0.0, 0.3, 0.0]],
    [0.86, [5.5, 6.0, 9.5],    [0.0, 0.8, 0.0]],
    [0.965, [3.4, 3.8, 7.4],   [0.0, 0.6, 0.0]],
    [1.00, [1.2, 3.4, 7.8],    [0.0, 0.6, 0.0]],
  ]);

  const STEPS = [0, 0.22, 0.42, 0.58, 0.72, 1.0001];

  function apply(p) {
    // 1  Boards land on the wrap, a hinge gap between each
    panels.forEach((pn, i) => pn.dropBoard(seg(p, 0.03 + 0.014 * i, 0.07 + 0.014 * i)));

    // 2  Magnets drop into the flap and front wall; every free edge is turned in
    magnets.forEach((m, i) => {
      const t = seg(p, 0.235 + 0.014 * i, 0.265 + 0.014 * i);
      m.position.copy(m.userData.home);
      m.position.y += 1.5 * (1 - out(t));
      setOpacity(m, clamp01(t * 3));
    });
    const cap = io(seg(p, 0.33, 0.365)), strip = io(seg(p, 0.36, 0.40));
    panels.forEach(pn => pn.turnIn(cap, strip));

    // 3  Lining, then the adhesive strips
    panels.forEach((pn, i) => pn.dropLiner(seg(p, 0.43 + 0.008 * i, 0.47 + 0.008 * i)));
    const tp = out(seg(p, 0.545, 0.575));
    tapes.forEach(t => { t.visible = tp > 0; t.scale.x = Math.max(tp, 0.0001); });

    // 4  Ships flat: the blank lifts and three more slide in beneath it — then away again
    const stacked = io(seg(p, 0.60, 0.65)) - io(seg(p, 0.70, 0.735));
    stack.forEach((g, i) => {
      g.visible = stacked > 0.001;
      g.position.set(-14 * (1 - stacked) * (i % 2 ? -1 : 1), i * (FLAT_H + 0.012), 0);
    });
    root.position.y = E + 3 * (FLAT_H + 0.012) * io(seg(p, 0.585, 0.62)) * (1 - io(seg(p, 0.715, 0.74)));

    // 5  Pops up: ears in, walls up, lid over, flap shut — then it turns to face the camera
    const earFold = HALF * io(seg(p, 0.745, 0.775));
    ears.forEach(e => { e.pivot.rotation.x = -e.end * earFold; });
    const fb = HALF * io(seg(p, 0.765, 0.805)), sides = HALF * io(seg(p, 0.79, 0.835));
    hF.rotation.x = -fb;
    hB.rotation.x = fb;
    hR.rotation.z = sides;
    hLt.rotation.z = -sides;
    hL.rotation.x = HALF * io(seg(p, 0.845, 0.895));
    hFl.rotation.x = HALF * inn(seg(p, 0.89, 0.925));
    body.position.z = BODY_OFF * (1 - io(seg(p, 0.745, 0.82)));
    root.rotation.y = lerp(HALF, 0.42, io(seg(p, 0.86, 0.965)));
    logo.material.emissiveIntensity = 0.3 + 0.55 * Math.sin(Math.PI * seg(p, 0.93, 1));

    poseCamera(p);
  }

  S.start({ steps: STEPS, apply });
})();
