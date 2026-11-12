// Shared by the living-things props: find a prop's size box by posing it at many times and merging the boxes,
// so a moving prop (walking person, flapping bird) gets one fixed box that never jumps between frames.
// Exports: sampledBounds(THREE, object, poseAt, times, pad) -> Box3 in the object's own space.

export function sampledBounds(THREE, object, poseAt, times, pad = 0) {
  const box = new THREE.Box3(), tmp = new THREE.Box3();
  const add = o => {
    if (o.userData.noBounds) return;
    if (o.geometry && !o.isInstancedMesh) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(tmp);
    }
    for (const c of o.children) add(c);
  };
  for (const t of times) {
    poseAt(t);
    object.updateMatrixWorld(true);
    add(object);
  }
  poseAt(0);
  object.updateMatrixWorld(true);
  return box.expandByScalar(pad);
}
