/* ═══════════════════════════════════════════════════════════════════
   Box Studio — parametric product models (Three.js r128)

   Every product in the range — cartons, cards, displays, rigid boxes —
   is built to the customer's size from thin slabs and cut sheets. Each
   product names its printable faces; a face has one artwork texture,
   and a part that forms only some of a face (a lid skirt, a flap) shows
   just its share of it, so artwork runs unbroken across the joins.

   Sizes arrive in scene units (1 unit = 100 mm). `open` runs 0 → 1.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const HALF = Math.PI / 2;
  // BoxGeometry orders its sides +x, −x, +y, −y, +z, −z; each has four UV pairs.
  const SIDE = { '+x': 0, '-x': 1, '+y': 2, '-y': 3, '+z': 4, '-z': 5 };

  function group(parent, x, y, z) {
    const g = new THREE.Group();
    g.position.set(x || 0, y || 0, z || 0);
    parent.add(g);
    return g;
  }

  // A slab w × h × d. `faces` lists the sides that carry artwork as
  // [side, faceId, [u0, v0, u1, v1]]; every other side shows the inside stock.
  // BoxGeometry's own UVs already read correctly from outside on every side, so
  // each rectangle is simply mapped into them.
  function slab(ctx, parent, w, h, d, faces, x, y, z) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mats = [ctx.inside, ctx.inside, ctx.inside, ctx.inside, ctx.inside, ctx.inside];
    (faces || []).forEach(([side, faceId, uv]) => {
      const i = SIDE[side], attr = geo.attributes.uv, r = uv || [0, 0, 1, 1];
      for (let k = i * 4; k < i * 4 + 4; k++) {
        attr.setXY(k, r[0] + attr.getX(k) * (r[2] - r[0]), r[1] + attr.getY(k) * (r[3] - r[1]));
      }
      mats[i] = ctx.face(faceId);
    });
    const m = new THREE.Mesh(geo, mats);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // A sheet cut to an outline, standing in the XY plane, printed on the side
  // facing +z (`frontId`) and optionally the other (`backId`). `outline` is a
  // list of [x, y] corners; u runs across `width`, v up `height`. `hole(path)`
  // may cut an opening.
  function sheet(ctx, parent, outline, width, height, t, frontId, backId, hole) {
    const shape = new THREE.Shape();
    outline.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
    shape.closePath();
    if (hole) { const path = new THREE.Path(); hole(path); shape.holes.push(path); }
    const g = group(parent);
    // The rear copy keeps the same outline (so an uneven shape is not mirrored)
    // and is drawn on its back side; seen from behind, left and right swap, so
    // its u runs the other way.
    const make = (faceId, rear) => {
      const geo = new THREE.ShapeGeometry(shape, 24);
      const uv = geo.attributes.uv, pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) {
        const u = (pos.getX(i) + width / 2) / width;
        uv.setXY(i, rear ? 1 - u : u, pos.getY(i) / height);
      }
      const mat = !faceId ? ctx.insideBack : rear ? ctx.faceBack(faceId) : ctx.face(faceId);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.z = rear ? -t / 2 : t / 2;
      g.add(mesh);
    };
    make(frontId, false);
    make(backId, true);
    return g;
  }
  const rectangle = (w, h) => [[-w / 2, 0], [w / 2, 0], [w / 2, h], [-w / 2, h]];

  // A rounded, plain or oval opening between (x0, y0) and (x1, y1).
  function opening(shape, x0, y0, x1, y1) {
    return path => {
      const hw = (x1 - x0) / 2, hh = (y1 - y0) / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (shape === 'oval') { path.absellipse(mx, my, hw, hh, 0, Math.PI * 2, true); return; }
      const r = shape === 'rounded' ? Math.min(hw, hh) * 0.28 : shape === 'slot' ? hh : 0;
      path.moveTo(x0 + r, y0); path.lineTo(x1 - r, y0);
      if (r) path.quadraticCurveTo(x1, y0, x1, y0 + r);
      path.lineTo(x1, y1 - r);
      if (r) path.quadraticCurveTo(x1, y1, x1 - r, y1);
      path.lineTo(x0 + r, y1);
      if (r) path.quadraticCurveTo(x0, y1, x0, y1 - r);
      path.lineTo(x0, y0 + r);
      if (r) path.quadraticCurveTo(x0, y0, x0 + r, y0);
    };
  }
  // The hang hole near the top of a card: round, or a slot for a peg hook.
  function hangHole(kind, w, h) {
    if (kind === 'round') { const r = Math.min(0.045, w * 0.07); return opening('oval', -r, h - 0.1 - r, r, h - 0.1 + r); }
    if (kind === 'slot') { const hw = Math.min(0.16, w * 0.22); return opening('slot', -hw, h - 0.13, hw, h - 0.07); }
    return null;
  }

  // Four walls and a floor, open at the top: outer size L × W × H, board t.
  // faces: which artwork each wall shows; vTop: how far up the face texture the
  // walls reach (1 = the whole face height).
  function tray(ctx, parent, L, W, H, t, faces, vTop) {
    const g = group(parent), f = faces || {}, v = vTop === undefined ? 1 : vTop;
    const on = (side, id, uv) => (id ? [[side, id, uv]] : null);
    // The base sits a hair inside the walls, so its edges never share a plane with a printed face.
    slab(ctx, g, L - 0.004, t, W - 0.004, on('-y', f.bottom), 0, t / 2, 0);
    slab(ctx, g, L, H, t, on('+z', f.front, [0, 0, 1, v]), 0, H / 2, W / 2 - t / 2);
    slab(ctx, g, L, H, t, on('-z', f.back, [0, 0, 1, v]), 0, H / 2, -W / 2 + t / 2);
    slab(ctx, g, t, H, W - 2 * t, on('+x', f.right, [0, 0, 1, v]), L / 2 - t / 2, H / 2, 0);
    slab(ctx, g, t, H, W - 2 * t, on('-x', f.left, [0, 0, 1, v]), -L / 2 + t / 2, H / 2, 0);
    return g;
  }
  const ALL_SIDES = { front: 'front', back: 'back', left: 'left', right: 'right', bottom: 'bottom' };

  // A plain bottle, sized to its container: something to see through a window or bag.
  function bottle(ctx, parent, r, h) {
    const g = group(parent), body = h * 0.66;
    const add = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; g.add(m); };
    add(new THREE.CylinderGeometry(r, r, body, 40), ctx.product, body / 2);
    add(new THREE.CylinderGeometry(r * 0.38, r * 0.5, h * 0.14, 32), ctx.product, body + h * 0.07);
    add(new THREE.CylinderGeometry(r * 0.44, r * 0.44, h * 0.1, 32), ctx.cap, body + h * 0.19);
    return g;
  }

  /* ══ CARTONS ════════════════════════════════════════════════════════ */

  // Mono carton, tuck end, with an optional window in the front.
  function carton(ctx, o) {
    const { L, W, H } = o, t = 0.006, g = new THREE.Group();
    slab(ctx, g, L, H, t, [['-z', 'back']], 0, H / 2, -W / 2);
    slab(ctx, g, t, H, W, [['+x', 'right']], L / 2, H / 2, 0);
    slab(ctx, g, t, H, W, [['-x', 'left']], -L / 2, H / 2, 0);
    slab(ctx, g, L, t, W, [['-y', 'bottom']], 0, 0, 0);

    const win = o.window;
    if (win.on) {
      // The front becomes a sheet with an opening, glazed behind with clear film.
      const ww = L * win.w / 100, wh = H * win.h / 100;
      const cx = -L / 2 + L * win.x / 100, cy = H * win.y / 100, m = 0.04;
      const x0 = Math.max(-L / 2 + m, cx - ww / 2), x1 = Math.min(L / 2 - m, cx + ww / 2);
      const y0 = Math.max(m, cy - wh / 2), y1 = Math.min(H - m, cy + wh / 2);
      sheet(ctx, g, rectangle(L, H), L, H, t, 'front', null, opening(win.shape, x0, y0, x1, y1)).position.z = W / 2;
      const film = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 + 0.03, y1 - y0 + 0.03), ctx.film);
      film.position.set((x0 + x1) / 2, (y0 + y1) / 2, W / 2 - t * 1.5);
      g.add(film);
      if (o.product) bottle(ctx, g, Math.min(L, W) * 0.3, H * 0.92).position.y = 0.01;
    } else {
      slab(ctx, g, L, H, t, [['+z', 'front']], 0, H / 2, W / 2);
    }

    // Top closure: hinged along the back edge, with a tuck flap that drops inside the front.
    const hinge = group(g, 0, H, -W / 2), tuckLen = Math.min(W * 0.6, 0.18);
    slab(ctx, hinge, L, t, W, [['+y', 'top']], 0, 0, W / 2);
    const tuck = group(hinge, 0, 0, W - t * 2);
    slab(ctx, tuck, L - 0.02, t, tuckLen, null, 0, 0, tuckLen / 2);
    tuck.rotation.x = HALF;
    hinge.rotation.x = -o.open * 1.95;
    return g;
  }

  // Litho-laminated corrugated carton (regular slotted style).
  function litho(ctx, o) {
    const { L, W, H } = o, t = 0.03, g = new THREE.Group();
    tray(ctx, g, L, W, H, t, ALL_SIDES);
    const lift = o.open * 2.25, minorLift = Math.min(1, o.open * 1.6) * 1.9;
    // Minor flaps fold in from the ends first, under the major flaps.
    const reach = Math.min(L / 2, W / 2);
    [1, -1].forEach(s => {
      const h = group(g, s * (L / 2 - t), H - t, 0);
      slab(ctx, h, reach, t, W - 2 * t, null, -s * reach / 2, 0, 0);
      h.rotation.z = -s * minorLift;
    });
    // Major flaps meet along the centre and carry the top artwork, half each.
    const front = group(g, 0, H, W / 2);
    slab(ctx, front, L, t, W / 2, [['+y', 'top', [0, 0, 1, 0.5]]], 0, 0, -W / 4);
    front.rotation.x = lift;
    const back = group(g, 0, H, -W / 2);
    slab(ctx, back, L, t, W / 2, [['+y', 'top', [0, 0.5, 1, 1]]], 0, 0, W / 4);
    back.rotation.x = -lift;
    return g;
  }

  /* ══ DISPLAYS ═══════════════════════════════════════════════════════ */

  // PDQ counter display: a low front lip, sloping sides, and a tall back
  // panel whose upper part is the header.
  const pdqLip = o => o.H * o.lip / 100;
  const pdqSide = o => Math.max(pdqLip(o), o.H * 0.55);
  function pdq(ctx, o) {
    const { L, W, H } = o, t = 0.03, g = new THREE.Group();
    const hf = pdqLip(o), hs = pdqSide(o);
    slab(ctx, g, L, t, W, [['-y', 'bottom']], 0, t / 2, 0);
    slab(ctx, g, L, hf, t, [['+z', 'front']], 0, hf / 2, W / 2 - t / 2);
    slab(ctx, g, L, H, t, [['+z', 'top'], ['-z', 'back']], 0, H / 2, -W / 2 + t / 2);
    // Sides: tall at the back, cut down to the lip at the front. A sheet's +x
    // runs toward the viewer's right as seen from outside, so the two mirror.
    const right = sheet(ctx, g, [[-W / 2, 0], [W / 2, 0], [W / 2, hs], [-W / 2, hf]], W, hs, t, 'right', null);
    right.rotation.y = HALF;
    right.position.x = L / 2 - t / 2;
    const left = sheet(ctx, g, [[-W / 2, 0], [W / 2, 0], [W / 2, hf], [-W / 2, hs]], W, hs, t, 'left', null);
    left.rotation.y = -HALF;
    left.position.x = -L / 2 + t / 2;
    if (o.product) {
      // A row of cartons, so the tray reads as a display.
      const n = Math.max(2, Math.min(5, Math.floor(L / 0.7))), pw = (L - 0.12) / n - 0.03;
      for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(pw, Math.min(H * 0.5, hs * 1.05), W * 0.55), i % 2 ? ctx.cap : ctx.product);
        p.position.set(-L / 2 + 0.075 + pw / 2 + i * (pw + 0.03), t + p.geometry.parameters.height / 2, W * 0.08);
        p.castShadow = true;
        g.add(p);
      }
    }
    return g;
  }

  /* ══ CARDS ══════════════════════════════════════════════════════════ */

  // Insert / backer card: one flat card, printed both sides.
  function backer(ctx, o) {
    const { L, H } = o, g = new THREE.Group();
    sheet(ctx, g, rectangle(L, H), L, H, 0.006, 'front', 'back', hangHole(o.hole, L, H));
    g.rotation.x = -0.16;                    // leaning back, as on a counter stand
    return g;
  }

  // Header card: folded over the top of a clear bag.
  function header(ctx, o) {
    const { L, W, H } = o, t = 0.006, g = new THREE.Group();
    const bagH = Math.max(H * 1.7, 1.1), tucked = H * 0.4, top = bagH - tucked + H;
    const hole = hangHole(o.hole, L, H);
    const front = sheet(ctx, g, rectangle(L, H), L, H, t, 'front', null, hole);
    front.position.set(0, top - H, W / 2);
    const back = sheet(ctx, g, rectangle(L, H), L, H, t, null, 'back', hole);
    back.position.set(0, top - H, -W / 2);
    slab(ctx, g, L, t, W + t, [['+y', 'top']], 0, top, 0);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(L * 0.94, bagH, W * 0.86), ctx.film);
    bag.position.y = bagH / 2;
    g.add(bag);
    if (o.product) bottle(ctx, g, Math.min(L * 0.3, W * 0.36), (bagH - tucked) * 0.9).position.y = 0.02;
    return g;
  }

  // L-, U- and J-cards: a back panel and a base, with a front panel whose
  // height sets the letter — none for an L, short for a J, full for a U.
  const lipHeight = o => o.H * o.lip / 100;
  function foldedCard(ctx, o) {
    const { L, W, H } = o, t = 0.008, g = new THREE.Group(), hf = lipHeight(o);
    slab(ctx, g, L, H, t, [['+z', 'front'], ['-z', 'back']], 0, H / 2, -W / 2);
    slab(ctx, g, L, t, W, [['+y', 'top'], ['-y', 'bottom']], 0, t / 2, 0);
    if (hf > 0) slab(ctx, g, L, hf, t, [['+z', 'left'], ['-z', 'right']], 0, hf / 2, W / 2);
    return g;
  }

  /* ══ RIGID BOXES ════════════════════════════════════════════════════ */

  function lidbase(ctx, o) {
    const { L, W, H } = o, t = 0.02, gap = 0.012, g = new THREE.Group();
    const skirt = H * o.lid / 100;
    tray(ctx, g, L, W, H, t, ALL_SIDES);
    // The lid is cut larger so it slides over the base; its skirt carries the top of each side's artwork.
    const lid = group(g, 0, H + t + o.open * (skirt + H * 0.55), 0);
    const LL = L + 2 * (t + gap), WW = W + 2 * (t + gap), uv = [0, 1 - skirt / H, 1, 1], y = -t - skirt / 2;
    slab(ctx, lid, LL, t, WW, [['+y', 'top']], 0, -t / 2, 0);
    slab(ctx, lid, LL, skirt, t, [['+z', 'front', uv]], 0, y, WW / 2 - t / 2);
    slab(ctx, lid, LL, skirt, t, [['-z', 'back', uv]], 0, y, -WW / 2 + t / 2);
    slab(ctx, lid, t, skirt, WW - 2 * t, [['+x', 'right', uv]], LL / 2 - t / 2, y, 0);
    slab(ctx, lid, t, skirt, WW - 2 * t, [['-x', 'left', uv]], -LL / 2 + t / 2, y, 0);
    lid.rotation.z = o.open * 0.1;
    return g;
  }

  // Magnetic closure, book style: a tray in a case whose lid hinges on the spine.
  function magnetic(ctx, o) {
    const { L, W, H } = o, t = 0.02, g = new THREE.Group();
    const flap = Math.min(H * 0.62, 0.7);
    slab(ctx, g, L, t, W, [['-y', 'bottom']], 0, t / 2, 0);
    const inner = tray(ctx, g, L - 0.01, W - 2 * t, H - t, t, { front: 'front', left: 'left', right: 'right' }, (H - t) / H);
    inner.position.set(0, t, t * 0.5);
    slab(ctx, g, L, H, t, [['-z', 'back']], 0, H / 2 + t, -W / 2 - t / 2);            // spine
    const hinge = group(g, 0, H + t, -W / 2 - t / 2);
    slab(ctx, hinge, L, t, W + t, [['+y', 'top']], 0, t / 2, (W + t) / 2);
    // The flap hangs from the lid's front edge onto the magnets; it carries the top of the front artwork.
    const fl = group(hinge, 0, t, W + t + t / 2);
    slab(ctx, fl, L, t, flap, [['+y', 'front', [0, 1, 1, 1 - flap / H]]], 0, 0, flap / 2);
    fl.rotation.x = HALF * (1 - 0.55 * o.open);
    hinge.rotation.x = -o.open * 1.85;
    return g;
  }

  function shoulder(ctx, o) {
    const { L, W, H } = o, t = 0.02, g = new THREE.Group();
    const hb = H * 0.56, rise = Math.min(H * 0.24, 0.3), hl = H - hb;
    tray(ctx, g, L, W, hb, t, ALL_SIDES, hb / H);
    // The neck is in the lining colour: the band you see as the lid lifts.
    const neck = tray(Object.assign({}, ctx, { inside: ctx.accent }), g, L - 2 * t - 0.006, W - 2 * t - 0.006, hb + rise - t, t, {});
    neck.position.y = t;
    const lid = group(g, 0, H + o.open * (rise + H * 0.7), 0), uv = [0, hb / H, 1, 1], y = -t - (hl - t) / 2;
    slab(ctx, lid, L, t, W, [['+y', 'top']], 0, -t / 2, 0);
    slab(ctx, lid, L, hl - t, t, [['+z', 'front', uv]], 0, y, W / 2 - t / 2);
    slab(ctx, lid, L, hl - t, t, [['-z', 'back', uv]], 0, y, -W / 2 + t / 2);
    slab(ctx, lid, t, hl - t, W - 2 * t, [['+x', 'right', uv]], L / 2 - t / 2, y, 0);
    slab(ctx, lid, t, hl - t, W - 2 * t, [['-x', 'left', uv]], -L / 2 + t / 2, y, 0);
    return g;
  }

  function drawer(ctx, o) {
    const { L, W, H } = o, t = 0.02, g = new THREE.Group();
    slab(ctx, g, L, t, W, [['+y', 'top']], 0, H - t / 2, 0);
    slab(ctx, g, L, t, W, [['-y', 'bottom']], 0, t / 2, 0);
    slab(ctx, g, t, H - 2 * t, W, [['+x', 'right']], L / 2 - t / 2, H / 2, 0);
    slab(ctx, g, t, H - 2 * t, W, [['-x', 'left']], -L / 2 + t / 2, H / 2, 0);
    const inner = tray(ctx, g, L - 2 * t - 0.008, W, H - 2 * t - 0.008, t, { front: 'front', back: 'back' });
    inner.position.set(0, t + 0.004, o.open * W * 0.72);
    const ribbon = new THREE.Mesh(new THREE.TorusGeometry(Math.min(0.1, H * 0.16), 0.012, 8, 24, Math.PI), ctx.ribbon);
    ribbon.rotation.z = Math.PI;
    ribbon.position.set(0, (H - 2 * t) * 0.5, W / 2 + 0.008);
    inner.add(ribbon);
    return g;
  }

  /* ══ THE RANGE ══════════════════════════════════════════════════════ */

  // faces(o) → [id, label, [width, height]] for each printable face.
  const boxFaces = o => [
    ['front', 'Front', [o.L, o.H]], ['back', 'Back', [o.L, o.H]],
    ['left', 'Left side', [o.W, o.H]], ['right', 'Right side', [o.W, o.H]],
    ['top', 'Top', [o.L, o.W]], ['bottom', 'Bottom', [o.L, o.W]],
  ];
  const cardFaces = o => [
    ['front', 'Back panel, display side', [o.L, o.H]], ['back', 'Back panel, rear', [o.L, o.H]],
    ['top', 'Base, upper side', [o.L, o.W]], ['bottom', 'Base, underside', [o.L, o.W]],
  ];
  const lippedFaces = o => cardFaces(o).concat([
    ['left', 'Front panel, outside', [o.L, lipHeight(o)]], ['right', 'Front panel, inside', [o.L, lipHeight(o)]],
  ]);

  // size: default L, W, H in mm. dims: what each is called (null hides it).
  // wraps: a flat sheet of artwork can be wrapped round its four sides.
  // controls: the extra settings the style offers. opens: whether it can be opened.
  const TYPES = [
    { id: 'carton', wraps: true, group: 'Cartons', name: 'Mono carton', hint: 'Tuck end, optional window', build: carton, faces: boxFaces,
      size: [120, 60, 180], controls: ['window'], opens: true },
    { id: 'litho', wraps: true, group: 'Cartons', name: 'Litho corrugated carton', hint: 'Litho-laminated, printed', build: litho, faces: boxFaces,
      size: [300, 220, 180], opens: true },
    { id: 'pdq', group: 'Displays', name: 'PDQ display', hint: 'Counter display tray with header', build: pdq,
      faces: o => [
        ['top', 'Back panel and header', [o.L, o.H]], ['front', 'Front lip', [o.L, pdqLip(o)]],
        ['left', 'Left side', [o.W, pdqSide(o)]], ['right', 'Right side', [o.W, pdqSide(o)]],
        ['back', 'Rear', [o.L, o.H]], ['bottom', 'Underside', [o.L, o.W]],
      ],
      size: [300, 200, 320], lip: 26, lipLabel: 'Front lip height', controls: ['lip', 'product'] },
    { id: 'backer', group: 'Cards', name: 'Insert / backer card', hint: 'Flat card, printed both sides', build: backer,
      faces: o => [['front', 'Front', [o.L, o.H]], ['back', 'Back', [o.L, o.H]]],
      size: [100, 0, 160], dims: { L: 'Width', W: null, H: 'Height' }, controls: ['hole'] },
    { id: 'header', group: 'Cards', name: 'Header card', hint: 'Folded over a polybag', build: header,
      faces: o => [['front', 'Front panel', [o.L, o.H]], ['back', 'Back panel', [o.L, o.H]], ['top', 'Top fold', [o.L, o.W]]],
      size: [120, 30, 70], dims: { L: 'Width', W: 'Bag depth', H: 'Height' }, controls: ['hole', 'product'] },
    { id: 'lcard', group: 'Cards', name: 'L-card', hint: 'Back panel and base', build: foldedCard, faces: cardFaces,
      size: [100, 50, 150], lip: 0, dims: { L: 'Width', W: 'Base depth', H: 'Height' } },
    { id: 'jcard', group: 'Cards', name: 'J-card', hint: 'Back panel, base and short front', build: foldedCard, faces: lippedFaces,
      size: [100, 40, 150], lip: 30, lipLabel: 'Front panel height', dims: { L: 'Width', W: 'Base depth', H: 'Height' }, controls: ['lip'] },
    { id: 'ucard', group: 'Cards', name: 'U-card', hint: 'Back panel, base and full front', build: foldedCard, faces: lippedFaces,
      size: [100, 50, 120], lip: 100, lipLabel: 'Front panel height', dims: { L: 'Width', W: 'Base depth', H: 'Height' }, controls: ['lip'] },
    { id: 'lidbase', wraps: true, group: 'Rigid boxes', name: 'Lid & base', hint: 'Two-piece rigid box', build: lidbase, faces: boxFaces,
      size: [220, 160, 90], controls: ['lid'], opens: true },
    { id: 'magnetic', wraps: true, group: 'Rigid boxes', name: 'Magnetic', hint: 'Book-style rigid box', build: magnetic, faces: boxFaces,
      size: [240, 170, 80], opens: true },
    { id: 'shoulder', wraps: true, group: 'Rigid boxes', name: 'Shoulder neck', hint: 'Rigid box with a neck', build: shoulder, faces: boxFaces,
      size: [160, 160, 110], opens: true },
    { id: 'drawer', wraps: true, group: 'Rigid boxes', name: 'Drawer', hint: 'Tray in a rigid sleeve', build: drawer, faces: boxFaces,
      size: [200, 120, 60], opens: true },
  ];

  window.StudioBoxes = { TYPES, byId: id => TYPES.find(t => t.id === id) };
})();
