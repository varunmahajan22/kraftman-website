/* ═══════════════════════════════════════════════════════════════════
   Box stories — shared engine (Three.js r128)

   Each story page builds its own scene and supplies apply(p, time),
   which poses everything for scroll progress p (0 → 1). This file owns
   the parts every story needs: renderer, lights, the box-making kit
   (board panels on a wrap, fold-up trays), the lid logo, the camera
   path, and the scroll → progress → render loop with its captions.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Clip mode: the homepage embeds each story as ?clip=1. The page chrome is
  // hidden and the build plays on a clock, looping, instead of following scroll.
  const CLIP = /[?&]clip(=|&|$)/.test(window.location.search);
  if (CLIP) document.documentElement.classList.add('rb-clip');

  const clamp01 = v => Math.min(1, Math.max(0, v));
  const ease = {
    clamp01,
    seg:  (p, a, b) => clamp01((p - a) / (b - a)),
    io:   t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    out:  t => 1 - Math.pow(1 - t, 3),
    inn:  t => t * t * t,
    lerp: (a, b, t) => a + (b - a) * t,
  };

  // opts.floorY: height of the shadow-catching floor (default 0).
  // opts.shadowRange: half-size of the area the key light casts shadows over.
  function create(opts) {
    opts = opts || {};
    const section = document.getElementById('rbScroll');
    const view    = document.getElementById('rbView');
    const canvas  = document.getElementById('rbCanvas');
    const stepEls = Array.from(document.querySelectorAll('#rbSteps li'));
    const hint    = document.getElementById('rbHint');
    const bar     = document.getElementById('rbBar');

    let renderer = null;
    if (window.THREE) {
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); }
      catch (e) { renderer = null; }
    }
    // No WebGL: the stylesheet turns the captions into a plain readable list.
    if (!renderer) { document.documentElement.classList.add('no-3d'); return null; }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CLIP ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 140);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b2a6, 0.7));
    const key = new THREE.DirectionalLight(0xfff3e2, 0.85);
    // Lit from the far side of the camera path so shadows fall toward the viewer.
    key.position.set(-7, 13, 6);
    key.target.position.set(1, 0, -2);
    key.castShadow = true;
    key.shadow.mapSize.set(CLIP ? 1024 : 2048, CLIP ? 1024 : 2048);
    const range = opts.shadowRange || 11;
    key.shadow.camera.left = -range; key.shadow.camera.right = range;
    key.shadow.camera.top = range;   key.shadow.camera.bottom = -range;
    key.shadow.camera.near = 1;      key.shadow.camera.far = 50;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.camera.updateProjectionMatrix();
    scene.add(key, key.target);
    const fill = new THREE.DirectionalLight(0xdfe8ff, 0.22);
    fill.position.set(8, 5, -4);
    scene.add(fill);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.ShadowMaterial({ opacity: 0.2 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = opts.floorY || 0;
    ground.receiveShadow = true;
    scene.add(ground);

    /* ── Builders ──────────────────────────────────────────────────── */
    // r128 treats hex colours as linear, so convert or everything renders washed out.
    const srgb = hex => new THREE.Color(hex).convertSRGBToLinear();

    function box(w, h, d, mat) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    }

    function setOpacity(mesh, o) {
      mesh.material.opacity = o;
      mesh.material.transparent = o < 0.999;
      mesh.visible = o > 0.002;
    }

    // A strip of paper made of hinged segments, each folding off the end of the
    // last. axis 'x': hinge lines run along X and the strip extends along ±Z;
    // axis 'z': the reverse. Positive fold angles always fold the strip upward.
    function makeChain(axis, dir, segs, mat, thick) {
      const root = new THREE.Group();
      const pivots = [];
      let parent = root, offset = 0;
      segs.forEach(s => {
        const pivot = new THREE.Group();
        const mesh = axis === 'x' ? box(s.width, thick, s.len, mat) : box(s.len, thick, s.width, mat);
        if (axis === 'x') { pivot.position.z = dir * offset; mesh.position.z = dir * s.len / 2; }
        else              { pivot.position.x = dir * offset; mesh.position.x = dir * s.len / 2; }
        pivot.add(mesh);
        parent.add(pivot);
        pivots.push(pivot);
        parent = pivot;
        offset = s.len;
      });
      root.userData = { axis, dir, pivots };
      return root;
    }
    function fold(chain, i, angle) {
      const { axis, dir, pivots } = chain.userData;
      if (axis === 'x') pivots[i].rotation.x = -dir * angle;
      else              pivots[i].rotation.z =  dir * angle;
    }

    let kick = function () {};        // replaced by start(); safe to call before then

    /* ── Standard materials ────────────────────────────────────────── */
    // overrides: { paper: hex, lining: hex } — the two colours a story picks.
    function materials(overrides) {
      const o = overrides || {};
      const std = (hex, rough, extra) =>
        new THREE.MeshStandardMaterial(Object.assign({ color: srgb(hex), roughness: rough }, extra || {}));
      return {
        board:  std(0xa39c90, 0.95),
        groove: std(0x5d584f, 1),
        tape:   std(0xc2a06a, 0.8),
        paper:  std(o.paper  !== undefined ? o.paper  : 0x1b3252, 0.5),
        lining: std(o.lining !== undefined ? o.lining : 0xd29a2a, 0.6),
        magnet: std(0xdfe3e9, 0.28, { metalness: 0.25 }),
      };
    }

    /* ── Box-making kit ────────────────────────────────────────────── */
    // The two things every rigid box is made of: board panels on a wrap, and
    // trays folded up from a blank. spec: { T, E, strip, board, paper, lining,
    // tape, groove } — board thickness, paper thickness, turn-in width, materials.
    function kit(spec) {
      const T = spec.T, E = spec.E, STRIP = spec.strip, HALF = Math.PI / 2;
      const chain = (axis, dir, segs, mat) => makeChain(axis, dir, segs, mat || spec.paper, E);
      const group = (parent, x, y, z) => {
        const g = new THREE.Group();
        g.position.set(x || 0, y || 0, z || 0);
        parent.add(g);
        return g;
      };

      // One board panel in the local frame of its hinge (the wrap's top surface
      // is y = 0). The board covers rect r = { x0, x1, z0, z1 }; the wrap under
      // it extends o.ext = { xm, xp, zm, zp } into neighbouring hinge gaps so the
      // paper reads as one sheet. o.free lists the edges that get a turn-in,
      // e.g. 'x+ z-'. Hinge gaps must be ≥ 2T or folded boards collide.
      function panel(parent, r, o) {
        o = o || {};
        const ext = Object.assign({ xm: 0, xp: 0, zm: 0, zp: 0 }, o.ext);
        const free = o.free || '';
        const paper = o.paper || spec.paper;
        const w = r.x1 - r.x0, l = r.z1 - r.z0, xc = (r.x0 + r.x1) / 2, zc = (r.z0 + r.z1) / 2;

        const sheet = box(w + ext.xm + ext.xp, E, l + ext.zm + ext.zp, paper);
        sheet.position.set(xc + (ext.xp - ext.xm) / 2, -E / 2, zc + (ext.zp - ext.zm) / 2);
        parent.add(sheet);

        const board = box(w, T, l, spec.board.clone());
        board.position.set(xc, T / 2, zc);
        parent.add(board);

        const ins = side => (free.indexOf(side) >= 0 ? 0.09 : 0.02);
        const linerY = T + 1.5 * E;          // the lining lies over the turn-ins
        const liner = box(w - ins('x-') - ins('x+'), E, l - ins('z-') - ins('z+'), (o.lining || spec.lining).clone());
        liner.position.set(xc + (ins('x-') - ins('x+')) / 2, linerY, zc + (ins('z-') - ins('z+')) / 2);
        parent.add(liner);

        const chains = [];
        const turnIn = (axis, dir, width, x, z) => {
          const c = chain(axis, dir, [{ len: T + E, width }, { len: STRIP, width }], paper);
          c.position.set(x, -E / 2, z);
          parent.add(c);
          chains.push(c);
        };
        if (free.indexOf('x+') >= 0) turnIn('z',  1, l, r.x1 + E / 2, zc);
        if (free.indexOf('x-') >= 0) turnIn('z', -1, l, r.x0 - E / 2, zc);
        if (free.indexOf('z+') >= 0) turnIn('x',  1, w, xc, r.z1 + E / 2);
        if (free.indexOf('z-') >= 0) turnIn('x', -1, w, xc, r.z0 - E / 2);

        return {
          sheet, board, liner, chains,
          // t: 0 → 1. The board (or lining) drops into place and fades in.
          dropBoard(t) { board.position.y = T / 2 + 1.6 * (1 - ease.out(t)); setOpacity(board, clamp01(t * 2.5)); },
          dropLiner(t) { liner.position.y = linerY + 1.4 * (1 - ease.out(t)); setOpacity(liner, clamp01(t * 2.5)); },
          // cap, strip: 0 → 1. Turn the wrap over the edge, then down onto the board.
          turnIn(cap, strip) { chains.forEach(c => { fold(c, 0, HALF * cap); fold(c, 1, HALF * strip); }); },
        };
      }

      // A tray: a cross-shaped greyboard blank whose walls fold up, plus its
      // wrap (a sheet with four wall → rim → inside chains) and its lining.
      // o: { W, D, H, paper, lining }. Origin: centre of the board's underside.
      function tray(o) {
        const W = o.W, D = o.D, H = o.H, paper = o.paper || spec.paper;
        const root = new THREE.Group();
        const core = group(root);                       // the board tray; lifts for spotting

        const base = box(W, T, D, spec.board);
        base.position.y = T / 2;
        core.add(base);
        // Each wall lies flat beside the base and hinges up about the base edge.
        const makeWall = (axis, dir) => {
          const pivot = new THREE.Group();
          const mesh = axis === 'x' ? box(W, T, H, spec.board) : box(H, T, D, spec.board);
          if (axis === 'x') { pivot.position.set(0, T / 2, dir * D / 2); mesh.position.z = dir * H / 2; }
          else              { pivot.position.set(dir * W / 2, T / 2, 0); mesh.position.x = dir * H / 2; }
          pivot.add(mesh);
          core.add(pivot);
          return pivot;
        };
        const wall = { f: makeWall('x', 1), b: makeWall('x', -1), r: makeWall('z', 1), l: makeWall('z', -1) };

        // V-groove lines on the flat blank; the upright walls sit on top of them.
        [1, -1].forEach(s => {
          const gx = box(W, 0.004, 0.022, spec.groove); gx.position.set(0, T + 0.001, s * D / 2);
          const gz = box(0.022, 0.004, D, spec.groove); gz.position.set(s * W / 2, T + 0.001, 0);
          gx.castShadow = gz.castShadow = false;
          core.add(gx, gz);
        });

        // Corner stays: two strips of tape per corner, grown from the base upward.
        const stays = [];
        const stayH = H * 0.92;
        const stayX = new THREE.BoxGeometry(0.16, stayH, 0.004).translate(0, stayH / 2, 0);
        const stayZ = new THREE.BoxGeometry(0.004, stayH, 0.16).translate(0, stayH / 2, 0);
        [1, -1].forEach(sx => [1, -1].forEach(sz => {
          const a = new THREE.Mesh(stayX, spec.tape);
          a.position.set(sx * (W / 2 + T / 2 - 0.08), T / 2 + 0.03, sz * (D / 2 + T / 2 + 0.002));
          const b = new THREE.Mesh(stayZ, spec.tape);
          b.position.set(sx * (W / 2 + T / 2 + 0.002), T / 2 + 0.03, sz * (D / 2 + T / 2 - 0.08));
          stays.push(a, b);
          core.add(a, b);
        }));

        // Wrap: a sheet under the base plus four hinged chains
        // (wall panel → cap over the rim → strip down the inside).
        const wrap = group(root);
        const wrapBase = box(W + T + 2 * E, E, D + T + 2 * E, paper);
        wrapBase.position.y = -E / 2;
        wrap.add(wrapBase);
        const wallLen = H + T / 2 + E;
        const wrapChain = (axis, dir) => {
          const outer = axis === 'x' ? W + T + 2 * E : D + T;
          const inner = axis === 'x' ? W - T - 2 * E : D - T - 2 * E;
          const c = chain(axis, dir, [
            { len: wallLen, width: outer },
            { len: T + E, width: outer },
            { len: Math.min(STRIP, H * 0.6), width: inner },
          ], paper);
          if (axis === 'x') c.position.set(0, -E / 2, dir * (D / 2 + T / 2 + E / 2));
          else              c.position.set(dir * (W / 2 + T / 2 + E / 2), -E / 2, 0);
          wrap.add(c);
          return c;
        };
        const wrapFB = [wrapChain('x', 1), wrapChain('x', -1)];
        const wrapLR = [wrapChain('z', 1), wrapChain('z', -1)];

        // Lining: floor plus four inner walls, stopping short of the rim so a
        // band of the turned-in wrap stays visible.
        const lining = group(root);
        const liningMat = (o.lining || spec.lining).clone();
        const hL = H - T / 2 - 0.06;
        const floor = box(W - T - 4 * E, E, D - T - 4 * E, liningMat);
        floor.position.y = T + E / 2;
        lining.add(floor);
        [1, -1].forEach(s => {
          const fz = box(W - T - 4 * E, hL, E, liningMat);
          fz.position.set(0, T + hL / 2, s * (D / 2 - T / 2 - 1.5 * E));
          const fx = box(E, hL, D - T - 4 * E, liningMat);
          fx.position.set(s * (W / 2 - T / 2 - 1.5 * E), T + hL / 2, 0);
          lining.add(fz, fx);
        });
        lining.visible = false;

        return {
          root, core, wrap, W, D, H,
          outerW: W + T + 2 * E,            // footprint once wrapped
          outerD: D + T + 2 * E,
          top: T / 2 + H + E,               // height of the wrapped rim above the origin
          // All arguments run 0 → 1.
          fold(fb, lr) {
            wall.f.rotation.x = -HALF * fb; wall.b.rotation.x = HALF * fb;
            wall.r.rotation.z =  HALF * lr; wall.l.rotation.z = -HALF * lr;
          },
          stay(t) { stays.forEach(st => { st.visible = t > 0; st.scale.y = Math.max(t, 0.0001); }); },
          wrapFold(fb, lr, cap, strip) {
            wrapFB.forEach(c => { fold(c, 0, HALF * fb); fold(c, 1, HALF * cap); fold(c, 2, HALF * strip); });
            wrapLR.forEach(c => { fold(c, 0, HALF * lr); fold(c, 1, HALF * cap); fold(c, 2, HALF * strip); });
          },
          line(t) {
            lining.visible = t > 0;
            lining.position.y = 1.5 * (1 - ease.out(t));
            liningMat.opacity = clamp01(t * 2.5);
            liningMat.transparent = liningMat.opacity < 0.999;
          },
        };
      }

      return { chain, panel, tray, group };
    }

    /* ── Lid logo ──────────────────────────────────────────────────── */
    // The company logo from Site Settings, printed on a small white label
    // `width` wide, as a flat mesh for the caller to place. Until the logo
    // loads — or if none is set — it shows gold-foil lettering instead.
    function lidLogo(width) {
      const cv = document.createElement('canvas');
      cv.width = 1024; cv.height = 384;
      const tex = new THREE.CanvasTexture(cv);
      tex.encoding = THREE.sRGBEncoding;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      const mat = new THREE.MeshStandardMaterial({
        map: tex, transparent: true, depthWrite: false, roughness: 0.35, metalness: 0.2,
        emissive: srgb(0xc8860a), emissiveMap: tex, emissiveIntensity: 0.3,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.scale.set(width, width * 384 / 1024, 1);

      let hasLogo = false;
      const drawLettering = () => {
        if (hasLogo) return;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, 1024, 384);
        ctx.fillStyle = '#E9BC55';
        ctx.textBaseline = 'middle';
        const tracked = (text, font, y, tracking) => {
          ctx.font = font;
          const widths = text.split('').map(ch => ctx.measureText(ch).width);
          let x = (1024 - widths.reduce((a, b) => a + b, 0) - tracking * (text.length - 1)) / 2;
          text.split('').forEach((ch, i) => { ctx.fillText(ch, x, y); x += widths[i] + tracking; });
        };
        tracked('KRAFTMAN', '800 128px Montserrat, Arial, sans-serif', 140, 22);
        ctx.fillRect(292, 232, 440, 5);
        tracked('PACKAGING', '700 60px Montserrat, Arial, sans-serif', 302, 30);
        tex.needsUpdate = true;
      };
      drawLettering();
      if (document.fonts && document.fonts.load) {
        Promise.all([document.fonts.load('800 128px Montserrat'), document.fonts.load('700 60px Montserrat')])
          .then(() => { drawLettering(); kick(); })
          .catch(() => {});
      }

      // Swap in the real logo: drawn on a white rounded label, because the
      // logo file has a white background and the lids are dark.
      const useLogo = img => {
        hasLogo = true;
        const pad = img.width * 0.08;
        const k = 1024 / (img.width + 2 * pad);
        cv.width = 1024;
        cv.height = Math.round((img.height + 2 * pad) * k);
        const ctx = cv.getContext('2d');
        const r = 40, w = cv.width, h = cv.height;
        ctx.beginPath();
        ctx.moveTo(r, 0); ctx.arcTo(w, 0, w, h, r); ctx.arcTo(w, h, 0, h, r);
        ctx.arcTo(0, h, 0, 0, r); ctx.arcTo(0, 0, w, 0, r);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.drawImage(img, pad * k, pad * k, img.width * k, img.height * k);
        mat.emissive.set(0x000000);
        mat.emissiveMap = null;
        mat.metalness = 0;
        mat.roughness = 0.55;
        mat.needsUpdate = true;
        tex.needsUpdate = true;
        const labelW = width * 0.72;
        mesh.scale.set(labelW, labelW * h / w, 1);
        kick();
      };
      if (window.fetch) {
        fetch('/api/settings')
          .then(res => (res.ok ? res.json() : null))
          .then(settings => {
            if (!settings || !settings.site_logo) return;
            const img = new Image();
            img.onload = () => useLogo(img);
            img.src = settings.site_logo;
          })
          .catch(() => {});
      }
      return mesh;
    }

    /* ── Camera path ───────────────────────────────────────────────── */
    // keys: [[p, [x, y, z], [look-at x, y, z]], …]. Returns pose(p), which
    // eases the camera between keys. Paths are framed for a roughly square
    // view; narrower views pull back along the line of sight.
    function cameraPath(keys) {
      const pos = new THREE.Vector3(), aim = new THREE.Vector3();
      return function (p) {
        let i = 0;
        while (i < keys.length - 2 && p > keys[i + 1][0]) i++;
        const a = keys[i], b = keys[i + 1];
        const t = ease.io(ease.seg(p, a[0], b[0]));
        pos.set(ease.lerp(a[1][0], b[1][0], t), ease.lerp(a[1][1], b[1][1], t), ease.lerp(a[1][2], b[1][2], t));
        aim.set(ease.lerp(a[2][0], b[2][0], t), ease.lerp(a[2][1], b[2][1], t), ease.lerp(a[2][2], b[2][2], t));
        const fit = camera.aspect < 1.15 ? Math.pow(1.15 / camera.aspect, 0.85) : 1;
        camera.position.copy(aim).addScaledVector(pos.sub(aim), fit);
        camera.lookAt(aim);
      };
    }

    /* ── Scroll → progress → render ────────────────────────────────── */

    // cfg.steps: progress at which each caption begins, plus a closing entry.
    // cfg.apply(p, time): pose the scene.
    // cfg.live: keep rendering while on screen so time-based motion can run.
    function start(cfg) {
      const steps = cfg.steps;
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const live = !!cfg.live && !reduceMotion;
      const t0 = performance.now();
      let target = 0, current = 0, raf = 0, onScreen = true;

      function resize() {
        const w = view.clientWidth, h = view.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        kick();
      }

      if (CLIP) {
        // About three seconds a step, a pause on the finished box, then again.
        const PLAY = 3 * (steps.length - 1), HOLD = 2.5;
        let clock = 0, last = 0;
        const clipFrame = now => {
          raf = 0;
          if (last) clock += Math.min((now - last) / 1000, 0.1);   // cap, so a hidden tab doesn't jump
          last = now;
          const p = reduceMotion ? 1 : clamp01((clock % (PLAY + HOLD)) / PLAY);
          cfg.apply(p, clock);
          bar.style.width = (p * 100).toFixed(2) + '%';
          renderer.render(scene, camera);
          if (onScreen && !reduceMotion && !document.hidden) kick();
          else last = 0;
        };
        kick = function () { if (!raf) raf = requestAnimationFrame(clipFrame); };
        window.addEventListener('resize', resize);
        if (window.ResizeObserver) new ResizeObserver(resize).observe(view);
        if (window.IntersectionObserver) {
          new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }).observe(view);
        }
        document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
        resize();
        return;
      }

      function readScroll() {
        const total = section.offsetHeight - window.innerHeight;
        target = total > 0 ? clamp01(-section.getBoundingClientRect().top / total) : 0;
        kick();
      }
      function frame(now) {
        raf = 0;
        const d = target - current;
        current = reduceMotion || Math.abs(d) < 0.0004 ? target : current + d * 0.14;
        cfg.apply(current, live ? (now - t0) / 1000 : 0);

        let active = 0;
        while (active < steps.length - 2 && current >= steps[active + 1]) active++;
        stepEls.forEach((el, i) => {
          el.classList.toggle('active', i === active);
          el.classList.toggle('done', i < active);
        });
        bar.style.width = (current * 100).toFixed(2) + '%';
        hint.classList.toggle('gone', current > 0.015);

        renderer.render(scene, camera);
        if (current !== target || (live && onScreen)) kick();
      }
      kick = function () { if (!raf) raf = requestAnimationFrame(frame); };

      window.addEventListener('scroll', readScroll, { passive: true });
      window.addEventListener('resize', () => { resize(); readScroll(); });
      if (window.ResizeObserver) new ResizeObserver(resize).observe(view);
      if (live && window.IntersectionObserver) {
        new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) kick(); }).observe(section);
      }

      resize();
      readScroll();
      current = target;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      frame(performance.now());
    }

    return {
      scene, camera, renderer, key,
      srgb, box, setOpacity, makeChain, fold,
      materials, kit, lidLogo, cameraPath,
      start, kick: () => kick(),
    };
  }

  // Header brand: show the logo from Site Settings when one is set; the
  // text wordmark in the markup is the fallback.
  (function () {
    const brand = document.querySelector('.rb-brand');
    if (CLIP || !brand || !window.fetch) return;
    fetch('/api/settings')
      .then(r => (r.ok ? r.json() : null))
      .then(settings => {
        if (!settings || !settings.site_logo) return;
        const img = new Image();
        img.alt = 'Kraftman Packaging';
        img.onload = () => { brand.textContent = ''; brand.appendChild(img); };
        img.src = settings.site_logo;
      })
      .catch(() => {});
  })();

  window.BoxStory = { create, ease };
})();
