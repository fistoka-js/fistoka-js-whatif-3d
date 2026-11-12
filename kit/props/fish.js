// Prop: fish. A chunky cartoon fish (or a small school of up to 30) with a wagging tail. Swims toward +x in place.
// Exports: meta, build(params, ctx). Each fish wags on its own phase; the school drifts gently. All a pure function of t.

import * as THREE from 'three';

export const meta = {
  name: 'fish',
  summary: 'A cartoon fish with a wagging tail; "count" 1..30 makes a small school. Good for ocean, food chain, pollution.',
  tags: ['animal', 'ocean', 'nature'],
  floats: true,
  params: {
    color: { type: 'color', default: 'orange', doc: 'body colour' },
    count: { type: 'int', min: 1, max: 30, default: 1, doc: 'how many fish (1 = one big fish, more = a school)' },
    seed: { type: 'int', min: 0, max: 999, default: 5, doc: 'which school arrangement' },
  },
  animatable: {},
};

// A flat fin from an outline (x,y pairs), a little thick so it is solid.
function fin(points, depth = 0.025) {
  const s = new THREE.Shape(); s.moveTo(...points[0]); for (const p of points.slice(1)) s.lineTo(...p); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }); g.translate(0, 0, -depth / 2); return g;
}

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  // Body: a sphere squeezed into a teardrop, head at +x. Vertex colours make the back darker than the belly.
  const body = keep(new THREE.SphereGeometry(1, 20, 14)), p = body.attributes.position, vc = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const f = x >= 0 ? 1 - 0.25 * x * x : 0.3 + 0.7 * (1 - Math.pow(-x, 1.7));
    p.setXYZ(i, x * 0.46, y * 0.26 * f + (x < 0 ? 0 : 0), z * 0.15 * f);
    const k = y > 0 ? 0.78 + 0.22 * (1 - y) : 1; vc.push(k, k, k);
  }
  body.setAttribute('color', new THREE.Float32BufferAttribute(vc, 3)); body.computeVertexNormals();
  const bodyM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.35, rim: 0.35 })); bodyM.vertexColors = true;
  const finM = keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.45, rim: 0.3 })); finM.side = THREE.DoubleSide;
  const white = keep(ctx.mat.solid(0xffffff, { rough: 0.2, main: false })), black = keep(ctx.mat.solid(0x0b0c10, { rough: 0.2, main: false, rim: 0 }));
  const tailG = keep(fin([[0.04, 0], [-0.26, 0.19], [-0.2, 0], [-0.26, -0.19]])), dorsG = keep(fin([[0.16, 0], [0.04, 0.2], [-0.08, 0.17], [-0.2, 0]])), pecG = keep(fin([[0, 0], [-0.1, -0.1], [-0.2, -0.06]], 0.02));
  const sph = keep(new THREE.SphereGeometry(1, 12, 8));

  const makeFish = () => {
    const g = new THREE.Group(), core = new THREE.Group(); g.add(core);
    core.add(new THREE.Mesh(body, bodyM));
    const tail = new THREE.Group(); tail.position.x = -0.42; core.add(tail); tail.add(new THREE.Mesh(tailG, finM));
    const d = new THREE.Mesh(dorsG, finM); d.position.set(0.0, 0.2, 0); core.add(d);
    for (const s of [-1, 1]) {
      const pf = new THREE.Mesh(pecG, finM); pf.position.set(0.16, -0.06, s * 0.13); pf.rotation.set(s * 0.5, 0, -0.2); core.add(pf);
      const e = new THREE.Mesh(sph, white); e.position.set(0.3, 0.07, s * 0.1); e.scale.setScalar(0.055); core.add(e);
      const pu = new THREE.Mesh(sph, black); pu.position.set(0.325, 0.07, s * 0.145); pu.scale.setScalar(0.03); core.add(pu);
    }
    return { g, core, tail };
  };

  const n = params.count, rng = ctx.rng, group = new THREE.Group(), fish = [];
  const k = n === 1 ? 1 : 0.42 / Math.pow(n, 0.28) + 0.15;   // size of each fish in a school
  for (let i = 0; i < n; i++) {
    const f = makeFish(); f.g.scale.setScalar(k);
    f.home = n === 1 ? new THREE.Vector3() : new THREE.Vector3((rng() - 0.5) * 0.9, (rng() - 0.5) * 0.6, (rng() - 0.5) * 0.7);
    f.ph = rng() * 6.28; f.sp = 5.5 + rng() * 2; f.yaw = (rng() - 0.5) * 0.25;
    fish.push(f); group.add(f.g);
  }
  const place = t => {
    for (const f of fish) {
      const w = Math.sin(t * f.sp + f.ph);
      f.tail.rotation.y = 0.55 * w; f.core.rotation.y = -0.1 * w + f.yaw;
      f.g.position.set(f.home.x + (n > 1 ? 0.04 * Math.sin(t * 0.7 + f.ph) : 0), f.home.y + 0.015 * Math.sin(t * 1.3 + f.ph), f.home.z);
    }
  };
  place(0);
  const bounds = n === 1 ? new THREE.Box3(new THREE.Vector3(-0.5, -0.27, -0.2), new THREE.Vector3(0.5, 0.27, 0.2))
    : new THREE.Box3(new THREE.Vector3(-0.5, -0.32, -0.34), new THREE.Vector3(0.5, 0.32, 0.34));
  return {
    object: group, bounds,
    update(t) { place(t); },
    dispose() { for (const x of made) x.dispose(); },
  };
}
