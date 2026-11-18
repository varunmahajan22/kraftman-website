/* ═══════════════════════════════════════════════════════════════════
   Shoulder-neck rigid box — scroll-driven construction

   Three trays. The neck is a taller, slightly smaller tray glued inside
   the base; it stands proud of the base's rim. The lid slides down over
   the neck and stops on that rim — the shoulder — so lid and base meet
   flush, wall to wall.
   Renderer, kit and scroll loop live in box-story-core.js.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const S = window.BoxStory && BoxStory.create();
  if (!S) return;
  const { scene } = S;
  const { seg, io, out, lerp } = BoxStory.ease;
  const HALF = Math.PI / 2;

  /* ── DIMENSIONS ──────────────────────────────────────────────────── */
  const W = 3, D = 2;
  const HB = 0.7;                  // base wall height
  const HL = 0.5;                  // lid wall height
  const RISE = 0.38;               // how far the neck stands above the shoulder
  const T = 0.06, E = 0.012, C = 0.008;
  // The neck's wrapped outside must fit the base's (and the lid's) inside.
  const SHRINK = 2 * T + 6 * E + 2 * C;
  const HN = HB + RISE - T - E;    // neck wall height (it stands on the base's floor)
  const NECK_SEAT = T + 2 * E;     // neck origin above the base origin, once glued in

  const BASE_AT = { x: -3.0, z: 1.4 }, LID_AT = { x: 3.0, z: 1.4 }, NECK_AT = { x: 0, z: -3.3 };
  const HOVER = 2.4;

  const M = S.materials({ paper: 0x1e1f24, lining: 0xd29a2a });
  const K = S.kit({ T, E, strip: 0.22, board: M.board, paper: M.paper, lining: M.lining, tape: M.tape, groove: M.groove });

  const base = K.tray({ W, D, H: HB });
  const lid  = K.tray({ W, D, H: HL });
  // The neck is wrapped in the lining colour: it is the flash of contrast
  // you see as the lid lifts.
  const neck = K.tray({ W: W - SHRINK, D: D - SHRINK, H: HN, paper: M.lining });
  scene.add(base.root, lid.root, neck.root);

  const logo = S.lidLogo(1.9);
  logo.position.set(0, -E - 0.002, 0);
  logo.rotation.x = HALF;
  lid.root.add(logo);

  // Turned over, the lid's rim lands on the base's rim.
  const LID_SEAT = E + base.top + lid.top + C;

  const poseCamera = S.cameraPath([
    [0.00, [0.0, 19.0, 5.0],   [0.0, 0.0, -0.8]],
    [0.15, [9.0, 11.5, 12.5],  [0.0, 0.3, -0.8]],
    [0.33, [9.5, 10.5, 13.0],  [0.0, 0.4, -0.8]],
    [0.56, [9.0, 9.5, 12.5],   [0.0, 0.5, -0.6]],
    [0.66, [4.0, 7.5, 12.0],   [-1.6, 0.6, 0.2]],
    [0.76, [5.0, 6.5, 11.5],   [-1.0, 0.7, 0.8]],
    [0.86, [7.0, 6.5, 11.0],   [0.0, 1.1, 0.4]],
    [0.965, [4.6, 3.4, 6.6],   [0.0, 0.6, 0.0]],
    [1.00, [-3.4, 3.0, 7.0],   [0.0, 0.6, 0.0]],
  ]);

  const STEPS = [0, 0.15, 0.33, 0.56, 0.76, 1.0001];

  function apply(p) {
    // 2  Three blanks fold up
    base.fold(io(seg(p, 0.16, 0.22)), io(seg(p, 0.20, 0.26)));
    lid.fold(io(seg(p, 0.18, 0.24)), io(seg(p, 0.22, 0.28)));
    neck.fold(io(seg(p, 0.20, 0.26)), io(seg(p, 0.24, 0.30)));
    const stay = out(seg(p, 0.30, 0.33));
    [base, lid, neck].forEach(t => t.stay(stay));

    // 3  Wrapped and turned in; neck and lid are lined
    const lift = 0.7 * (io(seg(p, 0.34, 0.37)) - io(seg(p, 0.40, 0.43)));
    const away = 1 - out(seg(p, 0.35, 0.405));
    [base, lid, neck].forEach(t => { t.core.position.y = lift; t.wrap.visible = p > 0.35; });
    base.wrap.position.x = -12 * away;
    lid.wrap.position.x = 12 * away;
    neck.wrap.position.z = -12 * away;
    const fb = io(seg(p, 0.43, 0.47)), lr = io(seg(p, 0.45, 0.49));
    const cap = io(seg(p, 0.49, 0.51)), strip = io(seg(p, 0.505, 0.53));
    [base, lid, neck].forEach(t => t.wrapFold(fb, lr, cap, strip));
    neck.line(seg(p, 0.53, 0.56));
    lid.line(seg(p, 0.535, 0.565));

    // 4  The neck lifts, crosses to the base and is glued inside it
    const nHop = io(seg(p, 0.585, 0.63)) - io(seg(p, 0.70, 0.755));
    const nGo = io(seg(p, 0.62, 0.71)), nSeat = io(seg(p, 0.70, 0.755));

    // 5  Base and lid come together; the lid turns over and lands on the shoulder
    const hop = io(seg(p, 0.77, 0.81)), flip = io(seg(p, 0.79, 0.86));
    const meet = io(seg(p, 0.84, 0.91)), seat = io(seg(p, 0.91, 0.965));

    const bx = lerp(BASE_AT.x, 0, meet), bz = lerp(BASE_AT.z, 0, meet);
    base.root.position.set(bx, E, bz);
    neck.root.position.set(
      lerp(NECK_AT.x, bx, nGo),
      E + NECK_SEAT * nSeat + 2.0 * nHop,
      lerp(NECK_AT.z, bz, nGo)
    );
    lid.root.position.set(
      lerp(LID_AT.x, 0, meet),
      lerp(E, HOVER, hop) - (HOVER - LID_SEAT) * seat,
      lerp(LID_AT.z, 0, meet)
    );
    lid.root.rotation.x = Math.PI * flip;
    logo.material.emissiveIntensity = 0.3 + 0.55 * Math.sin(Math.PI * seg(p, 0.94, 1));

    poseCamera(p);
  }

  S.start({ steps: STEPS, apply });
})();
