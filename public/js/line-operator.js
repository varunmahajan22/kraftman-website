/* ═══════════════════════════════════════════════════════════════════
   Line operator — the stylised figure shared by the 3D scenes.

   Built from primitives, about 6.8 units tall, origin at her feet,
   facing +z. Callers scale and place `root`, and animate the returned
   joints (legs, upper body, head, ponytail, shoulders and elbows).
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // m: { uniform, apron, trousers, shoe, skin, hair, eye, mouth, accent }
  function build(parent, m) {
    const HIP = 3.2;
    const group = (p, x, y, z) => {
      const g = new THREE.Group();
      g.position.set(x || 0, y || 0, z || 0);
      p.add(g);
      return g;
    };
    const put = (mesh, p, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; p.add(mesh); return mesh; };
    const cyl = (rTop, rBottom, h, mat, segs) => new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segs || 20), mat);
    const ball = (r, mat) => new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat);
    const slab = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

    const root = group(parent);

    const legs = [1, -1].map(s => {
      const hip = group(root, s * 0.3, HIP, 0);
      put(cyl(0.25, 0.19, 3.0, m.trousers), hip, 0, -1.5, 0);
      put(slab(0.42, 0.22, 0.78, m.shoe), hip, 0, -3.09, 0.14);
      return hip;
    });

    const upper = group(root, 0, HIP, 0);               // leans from the hips
    put(cyl(0.6, 0.5, 2.1, m.uniform, 24), upper, 0, 1.05, 0).scale.z = 0.72;
    put(slab(0.98, 1.75, 0.06, m.apron), upper, 0, 0.72, 0.4);
    put(slab(1.0, 0.1, 0.07, m.trousers), upper, 0, 0.9, 0.41).castShadow = false;   // apron tie
    put(cyl(0.17, 0.17, 0.32, m.skin), upper, 0, 2.2, 0);                            // neck

    const head = group(upper, 0, 2.95, 0);
    put(ball(0.66, m.skin), head, 0, 0, 0);
    // Hair: a cap tilted well back so it clears her eyes from a high camera.
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.71, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.54), m.hair);
    cap.rotation.x = -0.72;
    cap.castShadow = true;
    head.add(cap);
    [0.24, -0.24].forEach(x => { put(ball(0.07, m.eye), head, x, 0.04, 0.61).scale.z = 0.5; });
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 8, 20, Math.PI), m.mouth);
    smile.rotation.z = Math.PI;
    smile.position.set(0, -0.2, 0.615);
    head.add(smile);
    // Long side locks and a hairband, so she reads clearly from the front,
    // where the ponytail is hidden behind her head.
    [1, -1].forEach(sx => {
      const lock = cyl(0.15, 0.09, 1.25, m.hair, 14);
      lock.rotation.z = sx * 0.1;
      put(lock, head, sx * 0.62, -0.42, 0.05);
    });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.045, 8, 28, Math.PI), m.accent);
    band.position.set(0, 0.03, 0.1);
    band.rotation.x = -0.25;
    head.add(band);
    const pony = group(head, 0, 0.32, -0.6);            // ponytail, swings from the crown
    put(cyl(0.2, 0.07, 1.45, m.hair, 16), pony, 0, -0.72, 0);
    put(ball(0.13, m.accent), pony, 0, -0.02, 0);        // hair tie

    const arms = [1, -1].map(s => {                     // [left (+x), right (−x)]
      const shoulder = group(upper, s * 0.74, 1.9, 0);
      put(cyl(0.17, 0.15, 1.25, m.uniform), shoulder, 0, -0.625, 0);
      const elbow = group(shoulder, 0, -1.25, 0);
      put(cyl(0.14, 0.12, 1.15, m.skin), elbow, 0, -0.575, 0);
      put(ball(0.19, m.skin), elbow, 0, -1.2, 0);
      return { shoulder, elbow };
    });

    return { root, legs, upper, head, pony, left: arms[0], right: arms[1] };
  }

  window.LineOperator = { build };
})();
