/* ═══════════════════════════════════════════════════════════════════
   Box Studio — the flat layout

   The product opened out flat, beside the 3D view: every printable panel
   at its true size, with trim, crease and bleed lines and the main
   dimensions. It shows the same face surfaces the 3D model wears, so
   whatever is placed on one appears on the other. Text and logos can be
   dragged and resized here directly.

   A layout is a list of rectangles in millimetres (x to the right, y up):
     panels  printable faces  { id, x, y, w, h, uv?, rot? }
             uv   the part of the face this panel carries [u0, v0, u1, v1]
             rot  180 when the panel lies upside down on the sheet
     flaps   glue, tuck and dust flaps: board with no face of its own
   Where two rectangles share an edge it is a crease; every other edge is
   a cut. It is a layout for placing artwork, not a production dieline:
   the CAD team adds board allowances, flap tapers and locks.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const BLEED = 3, GAP = 24;                       // mm
  const INK = { trim: '#1d4ed8', crease: '#dc2626', bleed: '#16a34a', dim: '#55575c' };

  const P = (id, x, y, w, h, extra) => Object.assign({ id, x, y, w, h }, extra || {});
  const F = (x, y, w, h) => ({ x, y, w, h });

  /* ── LAYOUTS, one per product ─────────────────────────────────────── */
  // A box: the four sides in a row, top above the front, bottom below it.
  function boxLayout(s, kind) {
    const L = s.front[0], H = s.front[1], W = s.left[0];
    const glue = kind === 'carton' ? 15 : kind === 'litho' ? 30 : 0;
    const x = { front: glue, right: glue + L, back: glue + L + W, left: glue + 2 * L + W };
    const panels = ['front', 'right', 'back', 'left'].map(id => P(id, x[id], 0, s[id][0], H));
    const flaps = glue ? [F(0, 0, glue, H)] : [];
    if (kind === 'litho') {
      // A slotted carton: the top and bottom are each two flaps that meet in the middle.
      const f = W / 2;
      panels.push(P('top', x.front, H, L, f, { uv: [0, 0, 1, 0.5] }), P('top', x.back, H, L, f, { uv: [0, 0.5, 1, 1], rot: 180 }));
      panels.push(P('bottom', x.front, -f, L, f, { uv: [0, 0.5, 1, 1] }), P('bottom', x.back, -f, L, f, { uv: [0, 0, 1, 0.5], rot: 180 }));
      ['right', 'left'].forEach(id => flaps.push(F(x[id], H, W, f), F(x[id], -f, W, f)));
    } else {
      panels.push(P('top', x.front, H, L, W), P('bottom', x.front, -W, L, W));
      if (kind === 'carton') {
        const tuck = Math.min(15, W * 0.4), dust = Math.min(W, L) / 2;
        flaps.push(F(x.front, H + W, L, tuck), F(x.front, -W - tuck, L, tuck));
        ['right', 'left'].forEach(id => flaps.push(F(x[id], H, W, dust), F(x[id], -dust, W, dust)));
      }
    }
    return { panels, flaps, dims: [['x', x.front, L], ['x', x.right, W], ['y', 0, H]] };
  }
  // A folded card: the display side on the left, the reverse of the sheet on the right.
  function cardLayout(s) {
    const L = s.front[0], H = s.front[1], W = s.top[0] ? s.top[1] : 0;
    const lip = s.left ? s.left[1] : 0, x2 = L + GAP;
    const panels = [P('front', 0, lip + W, L, H), P('back', x2, lip + W, L, H), P('top', 0, lip, L, W), P('bottom', x2, lip, L, W)];
    if (lip) panels.push(P('right', 0, 0, L, lip), P('left', x2, 0, L, lip));
    const dims = [['x', 0, L], ['y', lip + W, H], ['y', lip, W]];
    if (lip) dims.push(['y', 0, lip]);
    return { panels, flaps: [], dims };
  }
  const LAYOUTS = {
    carton: s => boxLayout(s, 'carton'),
    litho: s => boxLayout(s, 'litho'),
    lidbase: s => boxLayout(s), magnetic: s => boxLayout(s), shoulder: s => boxLayout(s), drawer: s => boxLayout(s),
    backer: s => ({ panels: [P('front', 0, 0, s.front[0], s.front[1]), P('back', s.front[0] + GAP, 0, s.back[0], s.back[1])], flaps: [], dims: [['x', 0, s.front[0]], ['y', 0, s.front[1]]] }),
    // Folded over the top of a bag: front, the fold, then the back upside down.
    header: s => {
      const L = s.front[0], H = s.front[1], W = s.top[1];
      return { panels: [P('front', 0, 0, L, H), P('top', 0, H, L, W), P('back', 0, H + W, L, H, { rot: 180 })], flaps: [], dims: [['x', 0, L], ['y', 0, H], ['y', H, W]] };
    },
    lcard: cardLayout, jcard: cardLayout, ucard: cardLayout,
    // A display tray: the base in the middle, the lip in front, the back panel and header behind, a side each way.
    pdq: s => {
      const L = s.bottom[0], W = s.bottom[1], lip = s.front[1], side = s.left[1], H = s.top[1];
      return {
        panels: [P('front', W, 0, L, lip), P('bottom', W, lip, L, W), P('top', W, lip + W, L, H), P('left', 0, lip, W, side), P('right', W + L, lip, W, side),
          P('back', 2 * W + L + GAP, lip + W, L, H)],
        flaps: [], dims: [['x', W, L], ['x', 0, W], ['y', lip + W, H], ['y', 0, lip]],
      };
    },
  };

  /* ── GEOMETRY ─────────────────────────────────────────────────────── */
  // Split every rectangle's edges into creases (shared with a neighbour) and cuts (the rest).
  function edges(rects) {
    const trim = [], crease = [], near = (a, b) => Math.abs(a - b) < 0.01;
    const side = (r, k) => (k === 0 ? [r.y + r.h, r.x, r.x + r.w, 'h'] : k === 1 ? [r.y, r.x, r.x + r.w, 'h'] : k === 2 ? [r.x, r.y, r.y + r.h, 'v'] : [r.x + r.w, r.y, r.y + r.h, 'v']);
    rects.forEach(r => {
      for (let k = 0; k < 4; k++) {
        const [at, from, to, dir] = side(r, k), opposite = k ^ 1, shared = [];
        rects.forEach(o => {
          if (o === r) return;
          const [oat, ofrom, oto] = side(o, opposite);
          if (near(at, oat) && Math.min(to, oto) - Math.max(from, ofrom) > 0.01) shared.push([Math.max(from, ofrom), Math.min(to, oto)]);
        });
        shared.sort((a, b) => a[0] - b[0]);
        let cursor = from;
        const line = (a, b, list) => { if (b - a > 0.01) list.push(dir === 'h' ? [a, at, b, at] : [at, a, at, b]); };
        shared.forEach(([a, b]) => {
          line(cursor, a, trim);
          if (k === 0 || k === 3) line(a, b, crease);          // each shared edge is drawn once, from one side
          cursor = Math.max(cursor, b);
        });
        line(cursor, to, trim);
      }
    });
    return { trim, crease };
  }

  function create(api) {
    const canvas = api.canvas, c = canvas.getContext('2d');
    let layout = null, box = null, scale = 1, ox = 0, oy = 0, picked = null, drag = null, queued = false;

    const sizes = () => { const s = {}; api.faces().forEach(f => { s[f[0]] = [f[2][0] * 100, f[2][1] * 100]; }); return s; };
    const labels = () => { const s = {}; api.faces().forEach(f => { s[f[0]] = f[1]; }); return s; };
    function measure() {
      const make = LAYOUTS[api.typeId()];
      layout = make ? make(sizes()) : { panels: [], flaps: [], dims: [] };
      const all = layout.panels.concat(layout.flaps);
      box = all.reduce((b, r) => ({ x0: Math.min(b.x0, r.x), y0: Math.min(b.y0, r.y), x1: Math.max(b.x1, r.x + r.w), y1: Math.max(b.y1, r.y + r.h) }),
        { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
      layout.all = all;
      layout.lines = edges(all);
    }
    // mm → canvas pixels (y runs up on the sheet, down on the screen)
    const X = x => ox + (x - box.x0) * scale, Y = y => oy + (box.y1 - y) * scale;

    // Where a point on the sheet falls on a panel's face, in percent (x across, y up).
    function toFace(p, mx, my) {
      let s = (mx - p.x) / p.w, t = (my - p.y) / p.h;
      if (p.rot === 180) { s = 1 - s; t = 1 - t; }
      const uv = p.uv || [0, 0, 1, 1];
      return [(uv[0] + s * (uv[2] - uv[0])) * 100, (uv[1] + t * (uv[3] - uv[1])) * 100];
    }
    // …and back: a point on a face, as a point on the sheet.
    function toSheet(p, fx, fy) {
      const uv = p.uv || [0, 0, 1, 1];
      let s = (fx / 100 - uv[0]) / (uv[2] - uv[0]), t = (fy / 100 - uv[1]) / (uv[3] - uv[1]);
      if (p.rot === 180) { s = 1 - s; t = 1 - t; }
      return [p.x + s * p.w, p.y + t * p.h];
    }
    // An element's half-width and half-height, in percent of its face.
    function reach(el, id) {
      const size = sizes()[id];
      return [el.size / 2, el.size / 2 * size[0] / size[1] / api.proportionOf(el)];
    }

    function panelImage(p) {                      // the part of the face surface this panel shows
      const src = api.surface(p.id), uv = p.uv || [0, 0, 1, 1];
      return { src, sx: uv[0] * src.width, sy: (1 - uv[3]) * src.height, sw: (uv[2] - uv[0]) * src.width, sh: (uv[3] - uv[1]) * src.height };
    }
    function drawPanel(ctx, p, x, y, w, h) {       // x, y: top-left on the target; w, h: size on the target
      const im = panelImage(p);
      ctx.save();
      if (p.rot === 180) { ctx.translate(x + w, y + h); ctx.rotate(Math.PI); ctx.drawImage(im.src, im.sx, im.sy, im.sw, im.sh, 0, 0, w, h); }
      else ctx.drawImage(im.src, im.sx, im.sy, im.sw, im.sh, x, y, w, h);
      ctx.restore();
    }
    // Openings cut through the front: the carton window and the hang hole.
    function openings() {
      const st = api.state, s = sizes(), list = [], front = layout.panels.find(p => p.id === 'front');
      if (!front) return list;
      if (api.typeId() === 'carton' && st.window.on) {
        const w = st.window, ww = s.front[0] * w.w / 100, wh = s.front[1] * w.h / 100;
        list.push({ shape: w.shape, x: front.x + s.front[0] * w.x / 100 - ww / 2, y: front.y + s.front[1] * w.y / 100 - wh / 2, w: ww, h: wh });
      }
      if ((api.typeId() === 'backer' || api.typeId() === 'header') && st.hole !== 'none') {
        const top = front.y + front.h, mid = front.x + front.w / 2;
        if (st.hole === 'round') { const r = Math.min(4.5, front.w * 0.07); list.push({ shape: 'oval', x: mid - r, y: top - 10 - r, w: 2 * r, h: 2 * r }); }
        else { const hw = Math.min(16, front.w * 0.22); list.push({ shape: 'slot', x: mid - hw, y: top - 13, w: 2 * hw, h: 6 }); }
      }
      return list;
    }
    function trace(ctx, o, x, y, w, h) {
      const r = o.shape === 'rect' ? 0 : o.shape === 'rounded' ? Math.min(w, h) * 0.16 : Math.min(w, h) / 2;
      ctx.beginPath();
      if (o.shape === 'oval') ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      else if (!r) ctx.rect(x, y, w, h);
      else {
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
      }
    }

    function draw() {
      queued = false;
      const cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (!cw || !ch) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      measure();
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, cw, ch);
      if (!layout.all.length) return;
      // Room round the sheet for the bleed, the dimension lines and the view's own toolbar.
      const pad = { l: 46, r: 22, t: 64, b: 70 };
      scale = Math.min((cw - pad.l - pad.r) / (box.x1 - box.x0), (ch - pad.t - pad.b) / (box.y1 - box.y0));
      ox = pad.l + (cw - pad.l - pad.r - (box.x1 - box.x0) * scale) / 2;
      oy = pad.t + (ch - pad.t - pad.b - (box.y1 - box.y0) * scale) / 2;
      const rect = (r, grow) => [X(r.x) - grow, Y(r.y + r.h) - grow, r.w * scale + 2 * grow, r.h * scale + 2 * grow];

      // Bleed: the sheet grown by 3 mm, then covered again so only its outline is left.
      const bleed = BLEED * scale;
      c.fillStyle = INK.bleed; layout.all.forEach(r => c.fillRect.apply(c, rect(r, bleed)));
      c.fillStyle = '#f4f5f7'; layout.all.forEach(r => c.fillRect.apply(c, rect(r, bleed - 1)));

      c.fillStyle = api.state.colour.hex;
      layout.flaps.forEach(r => c.fillRect.apply(c, rect(r, 0)));
      layout.panels.forEach(p => { const [x, y, w, h] = rect(p, 0); drawPanel(c, p, x, y, w, h); });

      openings().forEach(o => {
        const x = X(o.x), y = Y(o.y + o.h), w = o.w * scale, h = o.h * scale;
        trace(c, o, x, y, w, h);
        c.fillStyle = '#f4f5f7'; c.fill();
        c.strokeStyle = INK.trim; c.lineWidth = 1.2; c.stroke();
      });

      const stroke = (lines, colour, dash) => {
        c.strokeStyle = colour; c.lineWidth = 1.2; c.setLineDash(dash || []);
        c.beginPath();
        lines.forEach(l => { c.moveTo(X(l[0]), Y(l[1])); c.lineTo(X(l[2]), Y(l[3])); });
        c.stroke(); c.setLineDash([]);
      };
      stroke(layout.lines.crease, INK.crease, [5, 4]);
      stroke(layout.lines.trim, INK.trim);

      // Panel names, and a gold frame round the face being edited.
      const names = labels(), seen = {};
      c.font = '600 10px Inter, sans-serif'; c.textBaseline = 'top';
      layout.panels.forEach(p => {
        const [x, y, w, h] = rect(p, 0);
        if (p.id === api.state.face) { c.strokeStyle = '#C8860A'; c.lineWidth = 2; c.strokeRect(x + 2, y + 2, w - 4, h - 4); }
        if (seen[p.id] || w < 44 || h < 18) return;
        seen[p.id] = true;
        const text = names[p.id], tw = c.measureText(text).width;
        if (tw + 12 > w) return;
        c.fillStyle = 'rgba(255,255,255,.86)'; c.fillRect(x + 5, y + 5, tw + 8, 15);
        c.fillStyle = '#0b0b0c'; c.fillText(text, x + 9, y + 8);
      });

      // Dimensions: widths under the sheet, heights to its left.
      c.strokeStyle = c.fillStyle = INK.dim; c.lineWidth = 1; c.font = '500 11px Inter, sans-serif';
      const tick = (x1, y1, x2, y2) => { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); };
      layout.dims.forEach(([axis, from, len]) => {
        const text = Math.round(len) + ' mm';
        if (axis === 'x') {
          const y = Y(box.y0) + bleed + 16, a = X(from), b = X(from + len);
          tick(a, y, b, y); tick(a, y - 4, a, y + 4); tick(b, y - 4, b, y + 4);
          c.textAlign = 'center'; c.textBaseline = 'top'; c.fillText(text, (a + b) / 2, y + 6);
        } else {
          const x = X(box.x0) - bleed - 14, a = Y(from), b = Y(from + len);
          tick(x, a, x, b); tick(x - 4, a, x + 4, a); tick(x - 4, b, x + 4, b);
          c.save(); c.translate(x - 6, (a + b) / 2); c.rotate(-Math.PI / 2);
          c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText(text, 0, 0); c.restore();
        }
      });
      c.textAlign = 'left';

      // The picked text or logo: a dashed frame with a handle to resize it.
      // (Layouts are rebuilt on every draw, so the picked panel is looked up again, and let go of if it has gone.)
      if (picked) {
        picked.panel = layout.panels[picked.index];
        if (!picked.panel || picked.panel.id !== picked.id || api.state.faces[picked.id].els.indexOf(picked.el) < 0) picked = null;
      }
      if (picked) {
        const el = picked.el, p = picked.panel, [rx, ry] = reach(el, p.id);
        const a = toSheet(p, el.x - rx, el.y - ry), b = toSheet(p, el.x + rx, el.y + ry);
        const x = Math.min(X(a[0]), X(b[0])), y = Math.min(Y(a[1]), Y(b[1])), w = Math.abs(X(b[0]) - X(a[0])), h = Math.abs(Y(b[1]) - Y(a[1]));
        c.strokeStyle = '#C8860A'; c.lineWidth = 1.5; c.setLineDash([4, 3]); c.strokeRect(x - 3, y - 3, w + 6, h + 6); c.setLineDash([]);
        c.fillStyle = '#C8860A'; c.fillRect(x + w - 2, y + h - 2, 10, 10);
        picked.handle = [x + w + 3, y + h + 3];
      }
    }
    const redraw = () => { if (!queued) { queued = true; requestAnimationFrame(draw); } };

    /* ── Dragging text and logos about on the sheet ─────────────────── */
    function locate(e) {
      const r = canvas.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      return { px, py, mx: box.x0 + (px - ox) / scale, my: box.y1 - (py - oy) / scale };
    }
    function hit(at) {
      for (let i = layout.panels.length - 1; i >= 0; i--) {
        const p = layout.panels[i];
        if (at.mx < p.x || at.mx > p.x + p.w || at.my < p.y || at.my > p.y + p.h) continue;
        const [fx, fy] = toFace(p, at.mx, at.my), els = api.state.faces[p.id].els;
        for (let k = els.length - 1; k >= 0; k--) {
          const [rx, ry] = reach(els[k], p.id);
          if (Math.abs(fx - els[k].x) <= rx + 1 && Math.abs(fy - els[k].y) <= ry + 1) return { panel: p, index: i, el: els[k], fx, fy };
        }
        return { panel: p, index: i, fx, fy };
      }
      return null;
    }
    canvas.addEventListener('pointerdown', e => {
      if (!layout) return;
      const at = locate(e);
      if (picked && picked.handle && Math.hypot(at.px - picked.handle[0], at.py - picked.handle[1]) < 12) {
        drag = { resize: true, from: at, size: picked.el.size };
      } else {
        const h = hit(at);
        if (!h) { picked = null; redraw(); return; }
        if (h.panel.id !== api.state.face) api.selectFace(h.panel.id);
        picked = h.el ? { el: h.el, panel: h.panel, index: h.index, id: h.panel.id } : null;
        drag = h.el ? { dx: h.fx - h.el.x, dy: h.fy - h.el.y } : null;
      }
      if (drag) canvas.setPointerCapture(e.pointerId);
      redraw();
    });
    canvas.addEventListener('pointermove', e => {
      if (!layout) return;
      const at = locate(e);
      if (!drag) {
        const h = hit(at), onHandle = picked && picked.handle && Math.hypot(at.px - picked.handle[0], at.py - picked.handle[1]) < 12;
        canvas.style.cursor = onHandle ? 'nwse-resize' : h && h.el ? 'move' : h ? 'pointer' : 'default';
        return;
      }
      const el = picked.el, p = picked.panel;
      if (drag.resize) {
        const [cx, cy] = toSheet(p, el.x, el.y), was = Math.hypot(X(cx) - drag.from.px, Y(cy) - drag.from.py) || 1;
        el.size = Math.round(Math.min(100, Math.max(5, drag.size * Math.hypot(X(cx) - at.px, Y(cy) - at.py) / was)));
      } else {
        const [fx, fy] = toFace(p, at.mx, at.my);
        el.x = Math.round(Math.min(100, Math.max(0, fx - drag.dx)));
        el.y = Math.round(Math.min(100, Math.max(0, fy - drag.dy)));
      }
      el.auto = false;                                  // moved by hand: automatic placement lets go of it
      api.moved(p.id);
    });
    const drop = () => { if (drag) { drag = null; api.settled(); } };
    canvas.addEventListener('pointerup', drop);
    canvas.addEventListener('pointercancel', drop);

    /* ── Download: the layout as a vector file at true size ─────────── */
    function svg() {
      measure();
      const m = 14, w = box.x1 - box.x0 + 2 * m, h = box.y1 - box.y0 + 2 * m;
      const sx = x => (x - box.x0 + m).toFixed(2), sy = y => (box.y1 - y + m).toFixed(2), n = v => v.toFixed(2);
      const path = lines => lines.map(l => 'M' + sx(l[0]) + ' ' + sy(l[1]) + 'L' + sx(l[2]) + ' ' + sy(l[3])).join('');
      const art = layout.panels.map(p => {
        const cv = document.createElement('canvas'), im = panelImage(p);
        cv.width = Math.max(1, Math.round(im.sw)); cv.height = Math.max(1, Math.round(im.sh));
        drawPanel(cv.getContext('2d'), p, 0, 0, cv.width, cv.height);
        return '<image x="' + sx(p.x) + '" y="' + sy(p.y + p.h) + '" width="' + n(p.w) + '" height="' + n(p.h) + '" preserveAspectRatio="none" href="' + cv.toDataURL('image/jpeg', 0.92) + '"/>';
      }).join('');
      const flaps = layout.flaps.map(r => '<rect x="' + sx(r.x) + '" y="' + sy(r.y + r.h) + '" width="' + n(r.w) + '" height="' + n(r.h) + '" fill="' + api.state.colour.hex + '"/>').join('');
      const holes = openings().map(o => {
        const x = +sx(o.x), y = +sy(o.y + o.h), r = o.shape === 'rect' ? 0 : o.shape === 'rounded' ? Math.min(o.w, o.h) * 0.16 : Math.min(o.w, o.h) / 2;
        return o.shape === 'oval'
          ? '<ellipse cx="' + n(x + o.w / 2) + '" cy="' + n(y + o.h / 2) + '" rx="' + n(o.w / 2) + '" ry="' + n(o.h / 2) + '"/>'
          : '<rect x="' + n(x) + '" y="' + n(y) + '" width="' + n(o.w) + '" height="' + n(o.h) + '" rx="' + n(r) + '"/>';
      }).join('');
      const names = labels(), seen = {};
      const text = layout.panels.filter(p => !seen[p.id] && (seen[p.id] = true)).map(p =>
        '<text x="' + sx(p.x + 2) + '" y="' + n(+sy(p.y + p.h) - 1.2) + '">' + names[p.id].replace(/&/g, '&amp;') + ' ' + Math.round(sizes()[p.id][0]) + ' × ' + Math.round(sizes()[p.id][1]) + ' mm</text>').join('');
      return '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + n(w) + 'mm" height="' + n(h) + 'mm" viewBox="0 0 ' + n(w) + ' ' + n(h) + '">\n' +
        '<title>Kraftman Packaging: flat layout for artwork placement. Not a production dieline.</title>\n' +
        '<g id="artwork">' + flaps + art + '</g>\n' +
        '<g id="crease" fill="none" stroke="' + INK.crease + '" stroke-width="0.25" stroke-dasharray="2 1.5"><path d="' + path(layout.lines.crease) + '"/></g>\n' +
        '<g id="trim" fill="#ffffff" stroke="' + INK.trim + '" stroke-width="0.25">' + holes + '<path fill="none" d="' + path(layout.lines.trim) + '"/></g>\n' +
        '<g id="labels" font-family="Arial, sans-serif" font-size="3" fill="' + INK.dim + '">' + text + '</g>\n' +
        '<g id="watermark" font-family="Arial, sans-serif" font-weight="bold" font-size="7" fill="#0b0b0c" fill-opacity="0.08" text-anchor="middle" transform="rotate(-25 ' + n(w / 2) + ' ' + n(h / 2) + ')">' + marks(w, h) + '</g>\n' +
        '<text x="' + n(w - 3) + '" y="' + n(h - 3) + '" text-anchor="end" font-family="Arial, sans-serif" font-size="3.2" fill="#0b0b0c">Made in Kraftman 3D Studio · kraftmanpackaging.com · For artwork placement only</text>\n</svg>\n';
    }

    // The watermark: the name repeated across the whole sheet.
    function marks(w, h) {
      const reach = Math.hypot(w, h) / 2, out = [];
      for (let y = h / 2 - reach, row = 0; y <= h / 2 + reach; y += 34, row++) {
        for (let x = w / 2 - reach - (row % 2 ? 55 : 0); x <= w / 2 + reach; x += 110) out.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '">KRAFTMAN PACKAGING</text>');
      }
      return out.join('');
    }

    if (window.ResizeObserver) new ResizeObserver(redraw).observe(canvas);
    return { redraw, svg, unpick: () => { picked = null; } };
  }

  window.StudioFlat = { create };
})();
