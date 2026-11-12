// Prop: virus. A round virus: bumpy core covered in knobbed spike proteins, tumbling slowly.
// Exports: meta, build(params, ctx). Spikes are instanced (cheap) and placed evenly on a sphere.

import * as THREE from 'three';

export const meta = {
  name: 'virus',
  summary: 'A round virus with spike proteins, slowly tumbling. Good for disease, infection, immunity stories.',
  tags: ['body', 'science'],
  floats: true,
  params: {
    color: { type: 'color', default: '#7cd36b', doc: 'colour of the virus body' },
    spikes: { type: 'color', default: '#ff5a5f', doc: 'colour of the spike knobs' },
    count: { type: 'int', min: 12, max: 90, default: 48, doc: 'how many spikes' },
  },
  animatable: {},
};

export function build(params, ctx) {
  const made = [], keep = x => { made.push(x); return x; };
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body);
  const CORE = 0.3;
  // Core: a sphere with soft bumps (vertex pushes along a few sine waves).
  const cg = keep(new THREE.SphereGeometry(CORE, 48, 32)), p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + 0.035 * Math.sin(x * 40) * Math.sin(y * 36 + 1) * Math.sin(z * 44 + 2);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  cg.computeVertexNormals();
  body.add(new THREE.Mesh(cg, keep(ctx.mat.solid(ctx.color(params.color), { rough: 0.45, rim: 0.3 }))));
  // Spikes: even points on a sphere (golden spiral). Each = a thin stalk + a round knob, both instanced.
  const n = params.count, stalkGeo = keep(new THREE.CylinderGeometry(0.014, 0.02, 1, 8)), knobGeo = keep(new THREE.SphereGeometry(1, 14, 10));
  const spikeM = keep(ctx.mat.solid(ctx.color(params.spikes), { rough: 0.4, rim: 0.3, main: false }));
  const stalks = new THREE.InstancedMesh(stalkGeo, spikeM, n), knobs = new THREE.InstancedMesh(knobGeo, spikeM, n);
  stalks.frustumCulled = knobs.frustumCulled = false;
  const dummy = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0), L = 0.14;
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) * 2 / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const q = new THREE.Quaternion().setFromUnitVectors(up, d);
    dummy.quaternion.copy(q); dummy.scale.set(1, L, 1); dummy.position.copy(d).multiplyScalar(CORE + L / 2 - 0.01); dummy.updateMatrix(); stalks.setMatrixAt(i, dummy.matrix);
    dummy.scale.setScalar(0.04 + 0.01 * ((i * 7) % 3)); dummy.position.copy(d).multiplyScalar(CORE + L + 0.01); dummy.updateMatrix(); knobs.setMatrixAt(i, dummy.matrix);
  }
  body.add(stalks, knobs);
  const E = CORE + L + 0.06;
  return {
    object: group,
    bounds: new THREE.Box3(new THREE.Vector3(-E, -E, -E), new THREE.Vector3(E, E, E)),
    update(t) { body.rotation.set(0.25 + 0.3 * Math.sin(t * 0.35), t * 0.32, 0.15 * Math.sin(t * 0.27)); },
    dispose() { for (const x of made) x.dispose(); stalks.dispose(); knobs.dispose(); },
  };
}
