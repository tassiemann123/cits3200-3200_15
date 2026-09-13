import { ALL_CFA_POINTS, groupForPoint, pointLabel, type PointName } from "../data/cfaSchema";
import type { SkeletonCoordinates, SkeletonRecord } from "../types";

export interface ImportedCoordinateRecord {
  name: string;
  coordinates: SkeletonCoordinates;
}

export interface CoordinateCsvParseResult {
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
    .replace(/^\uFEFF/, "")
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

export function serialiseCoordinateCsv(record: SkeletonRecord): string {
  const skeletonId = record.name.trim() || "Untitled skeleton";
  const rows = ALL_CFA_POINTS.flatMap((point) => {
    if (record.excludedGroups.includes(groupForPoint(point))) return [];
    const coordinate = record.coordinates[point];
    if (!coordinate?.every((value) => value !== null && Number.isFinite(value))) return [];
    return [[
      escapeCell(skeletonId),
      point,
      String(coordinate[0]),
      String(coordinate[1]),
      String(coordinate[2]),
    ].join(",")];
  });

  return ["skeleton_id,joint_name,x,y,z", ...rows].join("\r\n") + "\r\n";
}

export function parseCoordinateCsv(text: string): CoordinateCsvParseResult {
  const rows = parseRows(text);
  const warnings: string[] = [];
  if (rows.length < 2) return { records: [], warnings: ["The CSV contains no coordinate rows."] };

  const headers = rows[0].map(normaliseName);
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const skeletonIndex = find("skeleton_id", "skeleton", "record_name");
  const jointIndex = find("joint_name", "joint", "point", "landmark");
  const xIndex = find("x");
  const yIndex = find("y");
  const zIndex = find("z");

  if ([skeletonIndex, jointIndex, xIndex, yIndex, zIndex].some((index) => index < 0)) {
    return {
      records: [],
      warnings: ["The CSV must contain skeleton_id, joint_name, x, y, and z columns."],
    };
  }

  const records = new Map<string, SkeletonCoordinates>();
  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + 2;
    const skeletonId = row[skeletonIndex]?.trim();
    const jointName = row[jointIndex]?.trim();
    const point = jointName ? POINT_BY_NAME.get(normaliseName(jointName)) : undefined;
    const rawCoordinates = [row[xIndex]?.trim(), row[yIndex]?.trim(), row[zIndex]?.trim()];
    const coordinates = rawCoordinates.map((value) => value === "" || value === undefined ? Number.NaN : Number(value));

    if (!skeletonId) {
      warnings.push(`Row ${rowNumber} has no skeleton_id and was skipped.`);
      return;
    }
    if (!point) {
      warnings.push(`Row ${rowNumber} has an unknown joint_name and was skipped.`);
      return;
    }
    if (!coordinates.every(Number.isFinite)) {
      warnings.push(`Row ${rowNumber} has invalid X, Y, or Z values and was skipped.`);
      return;
    }

    const recordCoordinates = records.get(skeletonId) ?? {};
    if (recordCoordinates[point]) warnings.push(`Row ${rowNumber} replaces an earlier ${point} coordinate.`);
    recordCoordinates[point] = [coordinates[0], coordinates[1], coordinates[2]];
    records.set(skeletonId, recordCoordinates);
  });

  return {
    records: [...records.entries()].map(([name, coordinates]) => ({ name, coordinates })),
    warnings,
  };
}
