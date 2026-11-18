/* ═══════════════════════════════════════════════════════════════════
   Lid & base rigid box — scroll-driven construction

   Two trays made the same way. The lid is cut a few millimetres larger
   so that, turned over, it slides down over the base.
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
  const W = 3, D = 2, HB = 1.0;    // base tray
  const HL = 0.5;                  // lid wall height
  const T = 0.06, E = 0.012, C = 0.008;
  // The lid's lined inside must clear the base's wrapped outside.
  const GROW = 2 * T + 6 * E + 2 * C;
  const XB = -2.6, XL = 2.7;       // where base and lid are made, side by side
  const HOVER = 2.4;               // height at which the lid turns over

  const M = S.materials({ paper: 0x23513f });
  const K = S.kit({ T, E, strip: 0.22, board: M.board, paper: M.paper, lining: M.lining, tape: M.tape, groove: M.groove });

  const base = K.tray({ W, D, H: HB });
  const lid  = K.tray({ W: W + GROW, D: D + GROW, H: HL });
  scene.add(base.root, lid.root);

  // Logo on what will be the top of the lid: the underside of its tray.
  const logo = S.lidLogo(1.9);
  logo.position.set(0, -E - 0.002, 0);
  logo.rotation.x = HALF;
  lid.root.add(logo);

  // Turned over, the lid's lining rests on the base's rim.
  const SEAT_Y = E + base.top + T + E + C;

  const poseCamera = S.cameraPath([
    [0.00, [0.0, 15.0, 6.5],  [0.0, 0.0, 0.3]],
    [0.16, [7.5, 9.5, 11.5],  [0.0, 0.3, 0.0]],
    [0.36, [8.0, 8.5, 12.0],  [0.0, 0.4, 0.0]],
    [0.60, [7.5, 7.5, 11.0],  [0.0, 0.5, 0.0]],
    [0.78, [8.0, 8.0, 12.0],  [0.0, 1.1, 0.0]],
    [0.90, [6.0, 5.2, 8.6],   [0.0, 0.9, 0.0]],
    [0.965, [4.6, 3.6, 6.6],  [0.0, 0.6, 0.0]],
    [1.00, [-3.4, 3.2, 7.0],  [0.0, 0.6, 0.0]],
  ]);

  const STEPS = [0, 0.16, 0.36, 0.60, 0.76, 1.0001];

  function apply(p) {
    // 2  Both blanks fold up and are corner-stayed
    base.fold(io(seg(p, 0.17, 0.235)), io(seg(p, 0.21, 0.275)));
    lid.fold(io(seg(p, 0.20, 0.265)), io(seg(p, 0.24, 0.305)));
    const stay = out(seg(p, 0.305, 0.34));
    base.stay(stay); lid.stay(stay);

    // 3  Trays lift, wraps slide under from either side, paper folds up and in
    const lift = 0.7 * (io(seg(p, 0.37, 0.40)) - io(seg(p, 0.43, 0.46)));
    base.core.position.y = lid.core.position.y = lift;
    const away = 1 - out(seg(p, 0.38, 0.435));
    base.wrap.visible = lid.wrap.visible = p > 0.38;
    base.wrap.position.x = -12 * away;
    lid.wrap.position.x = 12 * away;
    const fb = io(seg(p, 0.46, 0.50)), lr = io(seg(p, 0.48, 0.52));
    const cap = io(seg(p, 0.52, 0.545)), strip = io(seg(p, 0.54, 0.57));
    base.wrapFold(fb, lr, cap, strip);
    lid.wrapFold(fb, lr, cap, strip);

    // 4  Lining
    base.line(seg(p, 0.61, 0.67));
    lid.line(seg(p, 0.65, 0.71));

    // 5  The lid rises, turns over, meets the base and settles onto it
    const hop = io(seg(p, 0.77, 0.81)), flip = io(seg(p, 0.79, 0.86));
    const meet = io(seg(p, 0.84, 0.91)), seat = io(seg(p, 0.91, 0.965));
    base.root.position.set(lerp(XB, 0, meet), E, 0);
    lid.root.position.set(lerp(XL, 0, meet), lerp(E, HOVER, hop) - (HOVER - SEAT_Y) * seat, 0);
    lid.root.rotation.x = Math.PI * flip;
    logo.material.emissiveIntensity = 0.3 + 0.55 * Math.sin(Math.PI * seg(p, 0.94, 1));

    poseCamera(p);
  }

  S.start({ steps: STEPS, apply });
})();
