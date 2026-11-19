// Ocean bump for the planet prop: a long gentle swell of water raised on the surface, built as a small polar-grid patch
// (1920 triangles) that covers only the bump footprint and is re-laid around the chosen spot when the values change.
// Exports: makeOceanBump(ctx, color, body, clouds)
//            -> { mesh, geo, mat, turn, set(ocean, lonDeg, latDeg), on, dir, reach },
//          makeCloudHole(cloudMat) -> { set(bump, turnDiff) }, plus the shared radii below.
// The water is an opaque lit mesh (no transparency, no draw-order tricks) that looks see-through: its shader mixes the
// planet's own surface colour at that spot with the water colour (see makeSeeThrough), so land shows through the blue.
// Its height is exactly 0 at its edge and falls off as a cosine (a gentle slope, so the foot stays above the thin sky
// shell: no pale ring). Size and height both go to zero smoothly with `ocean`;
// the mesh is hidden only below 0.0001, where it is smaller than a pixel.
// The outer foot of the swell lies below the cloud shell, so the cloud hole cuts that shell back over the footprint
// (otherwise it draws a pale ring). The planet's own clouds are drawn inside the water at full strength.
// Pure function of its inputs.

import * as THREE from 'three';

// Shared radii (planet units). planet.js uses these too, so the shells cannot clash.
export const BODY_R = 0.5;     // planet surface
export const CLOUD_R = 0.508;  // cloud shell
export const HALO_R = 0.57;    // air halo shell (as it always was: ocean 0 must look exactly as before)
const BASE = BODY_R + 0.0005;  // water radius where the swell ends (a hair above the body, which is a faceted sphere)
const RAISE = 0.05;            // swell height at ocean = 1: the crest is at radius about 0.55, under the halo shell
const REACH = 0.36;            // swell radius in radians at ocean = 1 (about 20 degrees)
const RINGS = 16, SEGS = 60;   // polar grid: 16 * 60 * 2 = 1920 triangles
const HIDE = 0.0001;           // ocean at or below this draws nothing (footprint under a pixel)

export function makeOceanBump(ctx, color, body, clouds) {
  const n = (RINGS + 1) * (SEGS + 1);
  const ring = new Float32Array(n), cph = new Float32Array(n), sph = new Float32Array(n); // per vertex: t, cos, sin
  const index = [];
  for (let i = 0; i <= RINGS; i++) for (let j = 0; j <= SEGS; j++) {
    const v = i * (SEGS + 1) + j, ph = j / SEGS * Math.PI * 2;
    ring[v] = i / RINGS; cph[v] = Math.cos(ph); sph[v] = Math.sin(ph);
    if (i < RINGS && j < SEGS) { const a = v, b = v + SEGS + 1; index.push(a, b, a + 1, a + 1, b, b + 1); }
  }
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
  const edge = new THREE.BufferAttribute(ring, 1);   // aT: 0 at the centre, 1 at the edge (the shader fades the water)
  const paint = new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3); // water colour
  geo.setAttribute('position', pos); geo.setAttribute('normal', nor); geo.setAttribute('color', paint);
  geo.setAttribute('aT', edge);
  geo.setIndex(index);

  // The colour lives in the vertices (white material). The middle is exactly the chosen colour (the scene lights tint
  // what is drawn a few degrees). The shoulder blends toward a lighter teal, like shallow water.
  const deep = new THREE.Color(color), shallow = deep.clone().lerp(new THREE.Color(0x3fa0c8), 0.3);
  const mat = ctx.mat.solid(color, { rough: 0.6, rim: 0.1, main: false }); // soft sheen, faint edge
  mat.color.set(0xffffff);
  mat.emissive = deep.clone().multiplyScalar(0.06);
  mat.vertexColors = true;
  const turn = { value: 0 };  // body turn minus cloud turn, set by the cloud hole
  makeSeeThrough(mat, body, clouds, turn);
  mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; // wins over the body at the edge
  const mesh = ctx.mat.noBounds(new THREE.Mesh(geo, mat));
  mesh.visible = false;
  const bump = { mesh, geo, mat, turn, on: false, dir: new THREE.Vector3(0, 0, 1), reach: 0, set };
  let last = '';   // the values the patch was last laid for; nothing is recomputed while they stay the same

  function set(ocean, lonDeg, latDeg) {
    bump.on = mesh.visible = ocean > HIDE;
    if (!bump.on) return;
    const key = `${ocean},${lonDeg},${latDeg}`;
    if (key === last) return;
    last = key;
    const lon = lonDeg * Math.PI / 180, lat = latDeg * Math.PI / 180;
    // lon 0, lat 0 faces the camera when the planet is not turned (+z); east is +x; lat 90 is +y.
    const cx = Math.cos(lat) * Math.sin(lon), cy = Math.sin(lat), cz = Math.cos(lat) * Math.cos(lon);
    const ex = Math.cos(lon), ez = -Math.sin(lon); // east at the centre (ey = 0)
    const fx = cy * ez, fy = cz * ex - cx * ez, fz = -cy * ex; // centre x east: north-ish, the other patch axis
    const reach = REACH * Math.pow(ocean, 0.6), height = RAISE * Math.pow(ocean, 0.8); // both 0 at ocean 0
    bump.dir.set(cx, cy, cz); bump.reach = reach;
    for (let v = 0; v < n; v++) {
      const t = ring[v], a = t * reach, ca = Math.cos(a), sa = Math.sin(a);
      // u: outward along the surface, d: unit direction of the vertex, tx.. (below): along-surface direction there
      const ux = ex * cph[v] + fx * sph[v], uy = fy * sph[v], uz = ez * cph[v] + fz * sph[v];
      const dx = cx * ca + ux * sa, dy = cy * ca + uy * sa, dz = cz * ca + uz * sa;
      const w = Math.cos(Math.PI / 2 * t);  // swell: 1 on the crest, 0 at the edge; rises fast, clears the sky shell
      const r = BASE + height * w;
      pos.setXYZ(v, dx * r, dy * r, dz * r);
      const drda = height * -0.5 * Math.PI * Math.sin(Math.PI / 2 * t) / reach; // radius fall per radian
      // tilt of the normal away from the centre (x1.3 so it reads as raised), eased off at the foot
      const k = -1.3 * drda / r * (1 - 0.8 * THREE.MathUtils.smoothstep(t, 0.8, 1));
      const tx = -cx * sa + ux * ca, ty = -cy * sa + uy * ca, tz = -cz * sa + uz * ca;
      const nx = dx + tx * k, ny = dy + ty * k, nz = dz + tz * k, nl = Math.hypot(nx, ny, nz) || 1;
      nor.setXYZ(v, nx / nl, ny / nl, nz / nl);
      const s = THREE.MathUtils.smoothstep(t, 0.3, 1);  // 0 in the deep middle, 1 in the shallows at the edge
      const m = shallow.clone().sub(deep).multiplyScalar(s).add(deep);
      paint.setXYZ(v, m.r, m.g, m.b);
    }
    pos.needsUpdate = nor.needsUpdate = paint.needsUpdate = true;
    geo.boundingSphere = null; geo.boundingBox = null;
  }
  return bump;
}

// See-through water inside the opaque shader. The fragment looks up the planet's own surface colour in the water's
// planet-frame direction (the same equirectangular mapping as three's SphereGeometry, so the continents line up
// exactly) and mixes it with the water colour: mostly water in the middle, nothing but planet at the very edge.
// Clouds (if any) are also drawn inside the water shader at full strength, since the cloud shell is cut back there.
const SPHERE_TEX = `
vec4 sphereTex(sampler2D t, vec3 d) {  // what SphereGeometry's uv gives at direction d
  float u = atan(d.z, -d.x) / 6.2831853, v = 1.0 - acos(clamp(d.y, -1.0, 1.0)) / 3.1415927;
  vec2 uvA = vec2(u, v), uvB = vec2(fract(u), v);  // uvB jumps where uvA is smooth: take the smooth one's slopes
  vec2 ax = dFdx(uvA), ay = dFdy(uvA), bx = dFdx(uvB), by = dFdy(uvB);
  bool a = abs(ax.x) + abs(ay.x) < abs(bx.x) + abs(by.x);
  return textureGrad(t, uvA, a ? ax : bx, a ? ay : by);
}`;
function makeSeeThrough(mat, body, clouds, turn) {
  if (!body || !body.map) return;  // shortcut: no surface map to look through (none of today's looks), plain water
  const u = { uLand: { value: body.map }, uTint: { value: body.color }, uTurn: turn };  // tint shared: stays live
  if (clouds) u.uCloud = { value: clouds.map };
  const rim = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    rim(shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = 'attribute float aT; varying float vT; varying vec3 vDir;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvT = aT; vDir = position;');
    shader.fragmentShader = 'uniform sampler2D uLand, uCloud; uniform vec3 uTint; uniform float uTurn;\n' +
      'varying float vT; varying vec3 vDir;' + SPHERE_TEX + shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
        vec3 d = normalize(vDir), lum = vec3(0.3, 0.55, 0.15);
        vec3 land = sphereTex(uLand, d).rgb * uTint;
        float keep = dot(land, lum) / max(dot(diffuseColor.rgb, lum), 0.001);  // the water hue, the land's brightness
        vec3 water = diffuseColor.rgb * 1.25 * keep;
        diffuseColor.rgb = mix(land, water, 0.6 * (1.0 - smoothstep(0.3, 1.0, vT)));` + (clouds ? `
        float c = cos(uTurn), s = sin(uTurn);  // into the clouds' frame (they turn at their own rate)
        vec4 cl = sphereTex(uCloud, vec3(d.x * c + d.z * s, d.y, -d.x * s + d.z * c));
        diffuseColor.rgb = mix(diffuseColor.rgb, cl.rgb, cl.a);` : ''));
  };
  mat.customProgramCacheKey = () => 'ocean-water' + (clouds ? '-cloud' : '');
}

// Cuts the cloud shell's alpha to zero over the water footprint, where the water draws the clouds itself instead.
// The cloud shader gets a hole (direction, strength, two cosines);
// at strength 0 it multiplies the alpha by exactly 1, so a planet without the bump draws exactly as before.
export function makeCloudHole(cloudMat) {
  const hole = { value: new THREE.Vector4(0, 0, 1, 0) }, cuts = { value: new THREE.Vector2(0.9, 0.99) };
  cloudMat.onBeforeCompile = shader => {
    shader.uniforms.uHole = hole; shader.uniforms.uHoleCos = cuts;
    shader.vertexShader = 'varying vec3 vHoleDir;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvHoleDir = position;');
    shader.fragmentShader = 'varying vec3 vHoleDir;\nuniform vec4 uHole;\nuniform vec2 uHoleCos;\n' +
      shader.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n' +
        'diffuseColor.a *= 1.0 - uHole.w * smoothstep(uHoleCos.x, uHoleCos.y, dot(normalize(vHoleDir), uHole.xyz));');
  };
  cloudMat.customProgramCacheKey = () => 'cloud-hole';
  // turnDiff: body turn minus cloud turn (radians about y), to bring the water spot into cloud space
  return {
    set(bump, turnDiff) {
      if (!bump.on) { hole.value.w = 0; return; }
      const c = Math.cos(turnDiff), s = Math.sin(turnDiff), d = bump.dir;
      bump.turn.value = turnDiff;
      hole.value.set(d.x * c + d.z * s, d.y, -d.x * s + d.z * c, 1);
      const r = Math.max(bump.reach, 0.008); // keep the two cosines apart for a tiny bump
      cuts.value.set(Math.cos(r), Math.cos(r * 0.94)); // the water draws its own clouds inside
    },
  };
}
