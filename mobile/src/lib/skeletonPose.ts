import * as THREE from "three";

/**
 * Precomputed facts about a piece's own rest-pose geometry, gathered once
 * when the model loads (see computeRawPieceGeometry + resolvePieceRestInfo
 * in SceneViewport.tsx) and reused on every re-pose.
 *
 * `fromTip`/`toTip` are NOT bounding-box corners -- they're the averaged
 * position of the piece's own real vertices that sit at each extreme of
 * its longest axis. A box corner is frequently a point in thin air next to
 * the mesh, not on it: bones aren't symmetric prisms, so the box's overall
 * centre-line often misses a tapered or off-centre joint entirely. Two
 * adjoining pieces (say, an upper arm and a forearm) are each posed so
 * their own idea of the elbow lands on the exact same target coordinate,
 * but if that idea is a corner floating outside the mesh, the two pieces'
 * actual surfaces still end up visibly apart even though the maths lines
 * up perfectly on paper. Using the real, nearby vertices instead keeps
 * both pieces' visible surfaces meeting where the joint actually is.
 *
 * Which of the two tips is `fromTip` (matching this piece's `from`
 * landmark, e.g. the wrist end of a hand) versus `toTip` (its `to`
 * landmark, e.g. the fingertip end) is resolved once, from the model's own
 * rest-pose geometry, by resolvePieceRestInfo -- never re-guessed per pose.
 * An earlier version of this code picked whichever assignment needed the
 * smaller rotation away from the *current* pose, which works only as long
 * as the requested pose stays close to the model's resting position. A
 * pose that genuinely differs a lot (an arm raised overhead instead of
 * hanging at the side) could then get the two tips backwards -- e.g. a
 * hand's fingertip end anchored at the wrist target instead of its wrist
 * end, leaving the hand pointing the wrong way entirely. Resolving each
 * piece's own tip identities once, from its fixed neighbour-to-neighbour
 * adjacency in the rest pose, is correct for every pose, not just ones
 * similar to rest.
 *
 * `topTip` is the same kind of real-vertex centroid, but always taken from
 * the piece's highest points (world +Y) regardless of which axis is
 * longest -- for a single-landmark piece (see the anchor branch below),
 * where there are no two ends to choose between.
 */
export interface PieceRestInfo {
  axisIndex: 0 | 1 | 2;
  fromTip: THREE.Vector3;
  toTip: THREE.Vector3;
  topTip: THREE.Vector3;
}

/**
 * Every piece in the bundled GLB was modelled facing the same way in its
 * untransformed rest pose -- confirmed directly by isolating the skull
 * mesh and checking which axis its face actually protrudes along -- so
 * this is a fixed constant for the whole model, not something measured
 * per piece. Only pieces that opt in with a `twist` landmark (see
 * SkeletonPieceSpec) use it.
 */
const NATIVE_FORWARD = new THREE.Vector3(0, 0, 1);

/**
 * Repositions, rotates, and stretches a single rigid mesh piece so its
 * long axis spans from `fromTarget` to `toTarget`, measured in the same
 * coordinate space as the piece's own untransformed position (i.e. the
 * piece must be parented under a group with no transform of its own).
 *
 * If both targets are the same point, the piece is just translated there
 * with no rotation or stretch -- for single-anchor pieces like the pelvis.
 */
export function poseSkeletonPiece(
  piece: THREE.Object3D,
  rest: PieceRestInfo,
  fromTarget: THREE.Vector3,
  toTarget: THREE.Vector3,
  stretch: "rod" | "uniform" | "anchor" = "rod",
  twistTarget?: THREE.Vector3,
): void {
  if (fromTarget.distanceToSquared(toTarget) < 1e-8) {
    // Only one landmark to go on, so there's no direction to derive an
    // attachment point from. The one piece this applies to (the pelvis)
    // hangs from its single landmark at the *top* -- most of its mass
    // (hip sockets, ischium) is below the sacral attachment, not centred
    // on it -- so topTip (not the piece's overall centre) is what should
    // land on that landmark.
    piece.quaternion.identity();
    piece.scale.set(1, 1, 1);
    piece.position.copy(fromTarget).sub(rest.topTip);
    piece.visible = true;
    return;
  }

  const targetDir = new THREE.Vector3().subVectors(toTarget, fromTarget);
  const targetLength = targetDir.length();
  if (targetLength < 1e-6) {
    piece.visible = false;
    return;
  }
  targetDir.normalize();

  // Which tip is the proximal ("from") end is already resolved, once, from
  // the model's own rest-pose geometry (see the PieceRestInfo comment) --
  // no per-pose guessing needed here.
  const localFrom = rest.fromTip;
  const localTo = rest.toTip;

  const restLength = Math.max(localTo.distanceTo(localFrom), 1e-6);
  // For "anchor" pieces, the two assigned landmarks are just reference
  // points on the piece -- not necessarily its two extreme ends the way a
  // limb's joints are (the gap between "centre_of_head" and
  // "head_proximal" is a fraction of the skull's actual height, for
  // instance). Sizing the *entire* piece to match that gap would shrink or
  // balloon it to something with no real relationship to its actual size,
  // so anchor pieces keep their true, modelled size and only move into
  // position; "rod" and "uniform" pieces still resize, since their two
  // landmarks genuinely are that bone's two ends.
  const scaleFactor = stretch === "anchor" ? 1 : targetLength / restLength;

  // A real long bone (upper arm, forearm, thigh, shin, spine) reads fine
  // stretched along just its one long axis -- it still looks like a bone,
  // only longer or shorter. A chunky, rounded, or irregular piece (the
  // ribcage) visibly warps if it's squashed or stretched that way instead,
  // so it's resized evenly on all three axes to keep its proportions intact.
  const scale = stretch === "rod"
    ? new THREE.Vector3(1, 1, 1).setComponent(rest.axisIndex, scaleFactor)
    : new THREE.Vector3(scaleFactor, scaleFactor, scaleFactor);

  // Pointing a piece from one landmark to the other only ever controls two
  // of its three rotational degrees of freedom -- which way its long axis
  // aims. The twist *around* that axis is left for the maths to pick
  // arbitrarily, which a roughly round, radially-symmetric rod (an upper
  // arm, a forearm, a thigh) can get away with, since it looks the same at
  // any twist. A piece with an actual front/back or a clear facing
  // direction -- a skull, the clavicle/shoulder-blade piece, a hand, a
  // foot -- can end up with an arbitrary twist around its own length axis
  // this way (e.g. a palm facing an odd way). But leaving that piece
  // unrotated entirely is worse: once its limb bends far from the rest
  // pose (an arm raised overhead instead of hanging at the side), an
  // unrotated hand or foot keeps pointing the *original* rest direction,
  // which reads as badly broken rather than just slightly twisted. So
  // every piece aligns its long axis to the real target direction; only
  // the *scale* distinction between "anchor" and the others remains
  // (anchor pieces keep their true modelled size instead of stretching).
  let quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3().subVectors(localTo, localFrom).normalize(),
    targetDir,
  );

  // A third landmark (e.g. the chin, for the skull) resolves exactly the
  // twist ambiguity described above, instead of leaving it arbitrary.
  // Project the piece's now-rotated facing direction, and the direction
  // toward the twist target, both onto the plane perpendicular to the
  // piece's main axis -- since both vectors are perpendicular to that same
  // axis, the rotation that takes one to the other is necessarily a pure
  // rotation *about* that axis, i.e. exactly the twist correction needed,
  // leaving the primary alignment above untouched.
  if (twistTarget) {
    const rotatedForward = NATIVE_FORWARD.clone().applyQuaternion(quaternion);
    const projRotated = rotatedForward.clone().addScaledVector(targetDir, -rotatedForward.dot(targetDir));
    const targetForwardRaw = new THREE.Vector3().subVectors(twistTarget, fromTarget);
    const projTarget = targetForwardRaw.clone().addScaledVector(targetDir, -targetForwardRaw.dot(targetDir));
    // Degenerate only if the twist landmark sits (almost) exactly on the
    // main axis itself, e.g. entered identical to one of the other two
    // landmarks -- there's no facing direction to derive a twist from, so
    // fall back to the primary alignment alone rather than divide by ~0.
    if (projRotated.lengthSq() > 1e-10 && projTarget.lengthSq() > 1e-10) {
      projRotated.normalize();
      projTarget.normalize();
      const twist = new THREE.Quaternion().setFromUnitVectors(projRotated, projTarget);
      quaternion = twist.multiply(quaternion);
    }
  }

  piece.scale.copy(scale);
  piece.quaternion.copy(quaternion);

  const scaledLocalFrom = localFrom.clone().multiply(scale).applyQuaternion(quaternion);
  piece.position.copy(fromTarget).sub(scaledLocalFrom);
  piece.visible = true;
}
