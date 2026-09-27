import { ALL_CFA_POINTS, boneLabelsFor, groupForBone, pointLabel, type PointName } from "../data/cfaSchema";
import type { CoordinateDraft, SkeletonCoordinates, SkeletonRecord } from "../types";

export interface ImportedCoordinateRecord {
  name: string;
  coordinates: SkeletonCoordinates;
  /** Additional contributing bones at a multi-bone joint (see SkeletonRecord.extraBoneCoordinates). */
  extraBoneCoordinates?: Partial<Record<PointName, CoordinateDraft[]>>;
  /** Bones explicitly marked absent, as `${point}:${boneIndex}` (see SkeletonRecord.excludedBones). */
  excludedBones?: string[];
}

export interface CoordinateCsvParseResult {
  graveyardName?: string;
  records: ImportedCoordinateRecord[];
  warnings: string[];
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normaliseName(value: string): string {
  return value
    .replace(/^﻿/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const POINT_BY_NAME = new Map<string, PointName>(
  ALL_CFA_POINTS.flatMap((point) => [
    [normaliseName(point), point],
    [normaliseName(pointLabel(point)), point],
  ]),
);

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Serialises one bone's coordinate at a joint into a CSV row, or a
 * "not present" row with blank coordinates when it's been explicitly
 * marked absent. Returns nothing for a bone that's present but simply
 * hasn't had a coordinate entered yet -- same convention as an ordinary
 * unset point, which is also omitted rather than written blank.
 */
function coordinateRow(
  skeletonId: string,
  point: PointName,
  boneLabel: string,
  coordinate: CoordinateDraft | undefined,
  present: boolean,
): string[] | null {
  if (!present) {
    return [escapeCell(skeletonId), point, boneLabel, "", "", "", "no"];
  }
  if (!coordinate?.every((value) => value !== null && Number.isFinite(value))) return null;
  return [escapeCell(skeletonId), point, boneLabel, String(coordinate[0]), String(coordinate[1]), String(coordinate[2]), "yes"];
}

export function serialiseCoordinateCsv(record: SkeletonRecord, graveyardName: string): string {
  const skeletonId = record.name.trim() || "Untitled skeleton";
  const rows = ALL_CFA_POINTS.flatMap((point) => {
    const boneLabels = boneLabelsFor(point);

    if (!boneLabels) {
      if (record.excludedGroups.includes(groupForBone(point, 0))) return [];
      const row = coordinateRow(skeletonId, point, "", record.coordinates[point], true);
      return row ? [row.join(",")] : [];
    }

    // Each bone's own group governs it (see groupForBone) so a bone filed
    // for display under a different joint's group -- currently just each
    // acetabulum's "Thigh (proximal)" bone, under the pelvis group but
    // governed by the leg -- still exports normally when that group, not
    // its own, is marked not present.
    return boneLabels.flatMap((boneLabel, boneIndex) => {
      if (record.excludedGroups.includes(groupForBone(point, boneIndex))) return [];
      const present = !(record.excludedBones ?? []).includes(`${point}:${boneIndex}`);
      const coordinate = boneIndex === 0
        ? record.coordinates[point]
        : (record.extraBoneCoordinates?.[point]?.[boneIndex - 1] ?? record.coordinates[point]);
      const row = coordinateRow(skeletonId, point, boneLabel, coordinate, present);
      return row ? [row.join(",")] : [];
    });
  });

  return [`Graveyard Name,${escapeCell(graveyardName)}`, "", "skeleton_id,joint_name,bone,x,y,z,present", ...rows].join("\r\n") + "\r\n";
}

export function parseCoordinateCsv(text: string): CoordinateCsvParseResult {
  const rows = parseRows(text);
  const warnings: string[] = [];
  if (rows.length < 2) return { records: [], warnings: ["The CSV contains no coordinate rows."] };

  const graveyardRow = rows.find((row) => normaliseName(row[0] ?? "") === "graveyard_name");
  const graveyardName = graveyardRow?.[1]?.trim() || undefined;
  const headerIndex = rows.findIndex((row) => normaliseName(row[0] ?? "") === "skeleton_id");
  if (headerIndex < 0) return { graveyardName, records: [], warnings: ["The CSV must contain skeleton_id, joint_name, x, y, and z columns."] };
  const headers = rows[headerIndex].map(normaliseName);
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const skeletonIndex = find("skeleton_id", "skeleton", "record_name");
  const jointIndex = find("joint_name", "joint", "point", "landmark");
  const xIndex = find("x");
  const yIndex = find("y");
  const zIndex = find("z");
  // Both optional: an older export (or one from another tool) without
  // these columns is still read fine -- every row is just treated as the
  // joint's primary/only bone, present.
  const boneIndexCol = find("bone", "bone_label", "contributor");
  const presentIndexCol = find("present", "presence");

  if ([skeletonIndex, jointIndex, xIndex, yIndex, zIndex].some((index) => index < 0)) {
    return {
      records: [],
      warnings: ["The CSV must contain skeleton_id, joint_name, x, y, and z columns."],
    };
  }

  interface Accumulator {
    coordinates: SkeletonCoordinates;
    extraBoneCoordinates: Partial<Record<PointName, CoordinateDraft[]>>;
    excludedBones: string[];
  }
  const records = new Map<string, Accumulator>();

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const skeletonId = row[skeletonIndex]?.trim();
    const jointName = row[jointIndex]?.trim();
    const point = jointName ? POINT_BY_NAME.get(normaliseName(jointName)) : undefined;

    if (!skeletonId) {
      warnings.push(`Row ${rowNumber} has no skeleton_id and was skipped.`);
      return;
    }
    if (!point) {
      warnings.push(`Row ${rowNumber} has an unknown joint_name and was skipped.`);
      return;
    }

    const boneLabels = boneLabelsFor(point);
    const boneCell = boneIndexCol >= 0 ? row[boneIndexCol]?.trim() : "";
    let boneIndex = 0;
    if (boneCell && boneLabels) {
      const matched = boneLabels.findIndex((label) => normaliseName(label) === normaliseName(boneCell));
      if (matched < 0) {
        warnings.push(`Row ${rowNumber} has an unrecognised bone "${boneCell}" for ${jointName}; treated as its primary bone.`);
      } else {
        boneIndex = matched;
      }
    } else if (boneCell && !boneLabels) {
      warnings.push(`Row ${rowNumber} names a bone for ${jointName}, which only has one; the bone column was ignored.`);
    }

    const accumulator = records.get(skeletonId) ?? { coordinates: {}, extraBoneCoordinates: {}, excludedBones: [] };
    records.set(skeletonId, accumulator);

    const presentCell = presentIndexCol >= 0 ? row[presentIndexCol]?.trim().toLowerCase() : undefined;
    if (presentCell === "no" || presentCell === "false" || presentCell === "0") {
      if (boneIndex === 0) {
        accumulator.excludedBones.push(`${point}:0`);
      } else {
        accumulator.excludedBones.push(`${point}:${boneIndex}`);
      }
      return;
    }

    const rawCoordinates = [row[xIndex]?.trim(), row[yIndex]?.trim(), row[zIndex]?.trim()];
    const coordinates = rawCoordinates.map((value) => value === "" || value === undefined ? Number.NaN : Number(value));
    if (!coordinates.every(Number.isFinite)) {
      warnings.push(`Row ${rowNumber} has invalid X, Y, or Z values and was skipped.`);
      return;
    }
    const coordinate: CoordinateDraft = [coordinates[0], coordinates[1], coordinates[2]];

    if (boneIndex === 0) {
      if (accumulator.coordinates[point]) warnings.push(`Row ${rowNumber} replaces an earlier ${point} coordinate.`);
      accumulator.coordinates[point] = coordinate;
    } else {
      const extras = accumulator.extraBoneCoordinates[point] ?? [];
      if (extras[boneIndex - 1]) warnings.push(`Row ${rowNumber} replaces an earlier ${point} coordinate.`);
      extras[boneIndex - 1] = coordinate;
      accumulator.extraBoneCoordinates[point] = extras;
    }
  });

  return {
    graveyardName,
    records: [...records.entries()].map(([name, accumulator]) => ({
      name,
      coordinates: accumulator.coordinates,
      extraBoneCoordinates: accumulator.extraBoneCoordinates,
      excludedBones: accumulator.excludedBones,
    })),
    warnings,
  };
}
