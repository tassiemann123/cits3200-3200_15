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
 * Default facing direction for a piece's twist correction, in that
 * piece's own untransformed rest-pose local space. Confirmed directly for
 * the skull by isolating its mesh and checking which axis its face
 * actually protrudes along, and for SK_Side (the ribcage) by rendering a
 * posed front and back view and checking the sternum -- not the shoulder
 * blades -- landed on the front one. An earlier pass got SK_Side's check
 * backwards and shipped it with a -Z override; this is only a default,
 * not a guaranteed whole-model constant, so `twistForward` (see
 * SkeletonPieceSpec) stays available for a future piece whose modelled
 * front genuinely does run the other way -- just verify it by actually
 * rendering both sides, not by eyeballing the raw mesh.
 */
const NATIVE_FORWARD = new THREE.Vector3(0, 0, 1);

/**
 * Builds an orthonormal frame from three points: `xAxis` runs right-to-left
 * (from `right` to `left`), and the frame's other two axes come from
 * whatever component of the direction toward `anchor` is left over once
 * the part already along `xAxis` is removed -- i.e. `anchor` just needs to
 * sit somewhere off the left-right line, not at any particular angle.
 * Returns undefined if the three points are degenerate for this purpose
 * (left and right coincide, or anchor sits exactly on their line), since
 * there's then no reliable frame to build.
 */
function frameFromTriangle(left: THREE.Vector3, right: THREE.Vector3, anchor: THREE.Vector3): THREE.Matrix4 | undefined {
  const xAxis = new THREE.Vector3().subVectors(left, right);
  if (xAxis.lengthSq() < 1e-10) return undefined;
  xAxis.normalize();

  const midpoint = new THREE.Vector3().addVectors(left, right).multiplyScalar(0.5);
  const towardAnchor = new THREE.Vector3().subVectors(anchor, midpoint);
  const inPlane = towardAnchor.addScaledVector(xAxis, -towardAnchor.dot(xAxis));
  if (inPlane.lengthSq() < 1e-10) return undefined;
  inPlane.normalize();

  const zAxis = new THREE.Vector3().crossVectors(xAxis, inPlane).normalize();
  const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();
  return new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
}

/**
 * Independently orients a single-landmark piece (the pelvis) from three of
 * its own landmarks, instead of borrowing another piece's rotation -- see
 * `orientationTriangle` in skeletonPieces.ts for the full rationale. Builds
 * a frame from the rest (neutral-pose) triangle and another from the
 * entered (current) triangle, and returns the rotation that takes one to
 * the other: identity when the entered triangle matches the rest triangle
 * exactly, and rotating away from identity in proportion to how much the
 * entered triangle actually differs.
 *
 * Returns undefined if either triangle is degenerate (see
 * frameFromTriangle) -- the caller should fall back to something else
 * (currently `rigidWith`) rather than silently applying no rotation.
 */
export function computeTriangleQuaternion(
  restLeft: THREE.Vector3,
  restRight: THREE.Vector3,
  restAnchor: THREE.Vector3,
  curLeft: THREE.Vector3,
  curRight: THREE.Vector3,
  curAnchor: THREE.Vector3,
): THREE.Quaternion | undefined {
  const restFrame = frameFromTriangle(restLeft, restRight, restAnchor);
  const curFrame = frameFromTriangle(curLeft, curRight, curAnchor);
  if (!restFrame || !curFrame) return undefined;

  const restQuat = new THREE.Quaternion().setFromRotationMatrix(restFrame);
  const curQuat = new THREE.Quaternion().setFromRotationMatrix(curFrame);
  return curQuat.multiply(restQuat.invert());
}

/**
 * Repositions, rotates, and stretches a single rigid mesh piece so its
 * long axis spans from `fromTarget` to `toTarget`, measured in the same
 * coordinate space as the piece's own untransformed position (i.e. the
 * piece must be parented under a group with no transform of its own).
 *
 * If both targets are the same point, the piece is just translated there.
 * By default that also means no rotation or stretch at all -- fine for a
 * piece that's genuinely orientation-free, but wrong for one that's
 * rigidly fused to a neighbouring two-point piece (the coccyx is fused to
 * the sacrum/ribcage assembly, not free-floating): left at the identity
 * rotation, it would keep facing however it happened to sit in the rest
 * pose no matter which way the rest of the body has actually been posed
 * -- looking fine for a standing skeleton (which is close to the rest
 * pose already) but visibly hanging off at the wrong angle for any other
 * orientation, a lying-down pose included. `rigidTransform` lets such a
 * piece instead copy the rotation and scale another, already-posed piece
 * ended up with, so the two move as the one rigid unit they anatomically
 * are.
 */
export function poseSkeletonPiece(
  piece: THREE.Object3D,
  rest: PieceRestInfo,
  fromTarget: THREE.Vector3,
  toTarget: THREE.Vector3,
  stretch: "rod" | "uniform" | "anchor" = "rod",
  twistTarget?: THREE.Vector3,
  bodyScale?: number,
  twistForward: THREE.Vector3 = NATIVE_FORWARD,
  rigidTransform?: { quaternion: THREE.Quaternion; scale: THREE.Vector3 },
  /**
   * Takes precedence over `rigidTransform` for a single-landmark piece's
   * rotation -- see `orientationTriangle` in skeletonPieces.ts and
   * computeTriangleQuaternion above. `rigidTransform` still supplies the
   * fallback rotation when this is undefined (landmarks missing, or the
   * triangle was degenerate).
   */
  orientationOverride?: THREE.Quaternion,
): void {
  if (fromTarget.distanceToSquared(toTarget) < 1e-8) {
    // Only one landmark to go on, so there's no direction to derive an
    // attachment point from. Most such pieces (the pelvis/coccyx) hang
    // from their single landmark at the *top* -- most of their mass (hip
    // sockets, ischium) is below the sacral attachment, not centred on it
    // -- so topTip (not the piece's overall centre) is what should land
    // on that landmark.
    // Only the ROTATION is actually borrowed rigidly from the referenced
    // piece -- its own scale isn't, since a piece stretched with "rod"
    // (the spine) carries an anisotropic scale (stretched along just its
    // own long axis) that means nothing applied to a different piece's
    // own local axes. The coccyx needs to resize with the patient's
    // stature like any other anchor-style piece, uniformly, via the same
    // bodyScale every such piece already uses -- not inherit a stretch
    // factor that was only ever meant for its rigid neighbour's own shape.
    const quaternion = orientationOverride ?? (rigidTransform ? rigidTransform.quaternion : new THREE.Quaternion());
    // Scaling with the patient's stature only ever made sense because the
    // one piece that takes this branch (the pelvis) also always supplied
    // bodyScale alongside rigidTransform -- decoupled here from *how* its
    // rotation was determined, since that's a separate concern now that
    // there are two possible sources for it.
    const scale = bodyScale !== undefined ? new THREE.Vector3(bodyScale, bodyScale, bodyScale) : new THREE.Vector3(1, 1, 1);
    piece.quaternion.copy(quaternion);
    piece.scale.copy(scale);
    const scaledTopTip = rest.topTip.clone().multiply(scale).applyQuaternion(quaternion);
    piece.position.copy(fromTarget).sub(scaledTopTip);
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
  // limb's joints are (the gap between "manubrium" and "left_shoulder"
  // is nowhere near the clavicle's own real length, for instance).
  // Sizing the piece to match *that* gap directly
  // would shrink or balloon it to something with no real relationship to
  // its actual size. But leaving it permanently frozen at 1 is its own
  // problem: a skeleton entered at infant proportions would still get an
  // adult-sized skull, hands, and feet stuck onto a shortened body.
  // `bodyScale` -- one overall scale factor derived from a piece that DOES
  // resize correctly (the spine, which spans true stature) -- gives anchor
  // pieces a reasonable size to track without using their own unreliable
  // two-landmark gap. It's an approximation (a real infant's head is
  // proportionally larger, not just uniformly smaller, than an adult's),
  // but it's far closer than never resizing at all, and needs no new
  // landmark data. "rod" and "uniform" pieces ignore it entirely -- their
  // own two landmarks already are that bone's real two ends.
  const scaleFactor = stretch === "anchor" ? (bodyScale ?? 1) : targetLength / restLength;

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
    const rotatedForward = twistForward.clone().applyQuaternion(quaternion);
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
