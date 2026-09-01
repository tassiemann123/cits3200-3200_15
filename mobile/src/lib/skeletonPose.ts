import * as THREE from "three";

/**
 * Repositions, rotates, and stretches a single rigid mesh piece so its
 * long axis spans from `fromTarget` to `toTarget`, measured in the same
 * coordinate space as the piece's own untransformed position (i.e. the
 * piece must be parented under a group with no transform of its own).
 *
 * If both targets are the same point, the piece is just translated there
 * with no rotation or stretch -- for single-anchor pieces like the pelvis.
 *
 * `restBox` must be the piece's own bounding box, measured before this
 * function has ever been called on it (its *rest* pose).
 */
export function poseSkeletonPiece(
  piece: THREE.Object3D,
  restBox: THREE.Box3,
  fromTarget: THREE.Vector3,
  toTarget: THREE.Vector3,
): void {
  if (fromTarget.distanceToSquared(toTarget) < 1e-8) {
    const center = restBox.getCenter(new THREE.Vector3());
    piece.quaternion.identity();
    piece.scale.set(1, 1, 1);
    piece.position.copy(fromTarget).sub(center);
    piece.visible = true;
    return;
  }

  const size = restBox.getSize(new THREE.Vector3());
  const axisIndex = [0, 1, 2].reduce(
    (longest, index) => (size.getComponent(index) > size.getComponent(longest) ? index : longest),
    0,
  );
  const axisDir = new THREE.Vector3();
  axisDir.setComponent(axisIndex, 1);

  const center = restBox.getCenter(new THREE.Vector3());
  const halfLength = size.getComponent(axisIndex) / 2;
  const endA = center.clone().addScaledVector(axisDir, -halfLength);
  const endB = center.clone().addScaledVector(axisDir, halfLength);

  // The proximal ("from") end is whichever axis extreme sits closer to the
  // model's own vertical centre -- true for a hanging limb in a normal
  // standing pose (a shoulder or hip sits nearer torso height than an
  // elbow, knee, wrist, or ankle does). This is a heuristic, not something
  // read directly from the file -- if a piece ends up flipped end-to-end,
  // this is the line to revisit for that specific piece.
  const proximalIsA = Math.abs(endA.y) < Math.abs(endB.y);
  const localFrom = proximalIsA ? endA : endB;
  const localTo = proximalIsA ? endB : endA;

  const targetDir = new THREE.Vector3().subVectors(toTarget, fromTarget);
  const targetLength = targetDir.length();
  if (targetLength < 1e-6) {
    piece.visible = false;
    return;
  }
  targetDir.normalize();

  const restLength = Math.max(localTo.distanceTo(localFrom), 1e-6);
  const scaleFactor = targetLength / restLength;

  const localAxis = new THREE.Vector3().subVectors(localTo, localFrom).normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(localAxis, targetDir);

  const scale = new THREE.Vector3(1, 1, 1);
  scale.setComponent(axisIndex, scaleFactor);

  piece.scale.copy(scale);
  piece.quaternion.copy(quaternion);

  const scaledLocalFrom = localFrom.clone().multiply(scale).applyQuaternion(quaternion);
  piece.position.copy(fromTarget).sub(scaledLocalFrom);
  piece.visible = true;
}
