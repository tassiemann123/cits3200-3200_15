import type { Landmark, ParseResult, Segment, SkeletonLayer } from "../types";
import { paletteColor } from "./colors";
import { surveyToWorld } from "./coordinates";

const CONNECTIONS: Array<[number, number]> = [
  [1, 2], [2, 3], [3, 4], [4, 5],
  [4, 6], [6, 7], [7, 8], [8, 9],
  [5, 10], [10, 11], [11, 12], [12, 13], [13, 14], [14, 15],
  [4, 16], [16, 17], [17, 18], [18, 19],
  [5, 20], [20, 21], [21, 22], [22, 23], [23, 24], [24, 25],
];

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function pointNumber(value: string): number | null {
  const match = value.match(/(?:point\s*)?(\d+)/i);
  return match ? Number(match[1]) : null;
}

export function parseCsv(text: string, sourceName = "Imported CSV"): ParseResult {
  const rows = parseRows(text);
  const warnings: string[] = [];
  if (rows.length < 2) return { layers: [], warnings: ["CSV 没有数据行。"] };

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  const find = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const skeletonIndex = find("skeleton_id", "skeleton", "body_id", "bp", "context");
  const jointIndex = find("joint_name", "joint", "point", "landmark");
  const xIndex = find("x");
  const yIndex = find("y");
  const zIndex = find("z");
  if ([skeletonIndex, jointIndex, xIndex, yIndex, zIndex].some((index) => index < 0)) {
    return { layers: [], warnings: ["CSV 必须包含 skeleton_id、joint_name、x、y、z 列。"] };
  }

  const groups = new Map<string, Landmark[]>();
  rows.slice(1).forEach((row, offset) => {
    const skeleton = row[skeletonIndex]?.trim();
    const joint = row[jointIndex]?.trim();
    const x = Number(row[xIndex]);
    const y = Number(row[yIndex]);
    const z = Number(row[zIndex]);
    if (!skeleton || !joint || ![x, y, z].every(Number.isFinite)) {
      warnings.push(`第 ${offset + 2} 行缺少标识或有效坐标，已跳过。`);
      return;
    }
    const landmarks = groups.get(skeleton) ?? [];
    landmarks.push({ id: `${skeleton}-${joint}-${offset}`, label: joint, position: surveyToWorld(x, z, y) });
    groups.set(skeleton, landmarks);
  });

  const layers: SkeletonLayer[] = [...groups.entries()].map(([name, landmarks], index) => {
    const byPoint = new Map<number, Landmark>();
    landmarks.forEach((landmark) => {
      const number = pointNumber(landmark.label);
      if (number !== null) byPoint.set(number, landmark);
    });
    const segments: Segment[] = CONNECTIONS.flatMap(([from, to]) => {
      const start = byPoint.get(from);
      const end = byPoint.get(to);
      return start && end ? [{ from: start.position, to: end.position }] : [];
    });
    return {
      id: `${sourceName.replace(/\W+/g, "-").toLowerCase()}-${name.toLowerCase().replace(/\W+/g, "-")}-${index}`,
      name,
      sourceName,
      color: paletteColor(index),
      visible: true,
      locked: false,
      modelType: "landmarks",
      segments,
      landmarks,
      notes: "",
    };
  });
  return { layers, warnings };
}
