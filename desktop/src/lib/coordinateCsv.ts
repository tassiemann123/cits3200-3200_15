/**
 Shared CSV format used by both the mobile and desktop applications.

 Format:
 Graveyard Name,<name>
 skeleton_id,joint_name,bone,x,y,z,present
 */

export interface CoordinateCsvRow {
  skeletonId: string;
  jointName: string;
  bone: string;
  x: number | null;
  y: number | null;
  z: number | null;
  present: boolean;
}

export interface CoordinateCsvRecord {
  name: string;
  rows: CoordinateCsvRow[];
}

export interface CoordinateCsvParseResult {
  graveyardName?: string;
  records: CoordinateCsvRecord[];
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
    } else if (
      (character === "\n" || character === "\r") &&
      !quoted
    ) {
      if (character === "\r" && text[index + 1] === "\n") {
        index += 1;
      }

      row.push(cell.trim());

      if (row.some(Boolean)) {
        rows.push(row);
      }

      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row.push(cell.trim());

  if (row.some(Boolean)) {
    rows.push(row);
  }

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

function escapeCell(value: string): string {
  return /[",\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

function parseCoordinate(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

/**
 * Converts coordinate records into the shared CSV format.
 */
export function serialiseCoordinateCsv(
  graveyardName: string,
  records: CoordinateCsvRecord[],
): string {
  const rows: string[] = [
    `Graveyard Name,${escapeCell(graveyardName)}`,
    "",
    "skeleton_id,joint_name,bone,x,y,z,present",
  ];

  records.forEach((record) => {
    const skeletonId = record.name.trim() || "Untitled skeleton";

    record.rows.forEach((row) => {
      rows.push(
        [
          escapeCell(skeletonId),
          escapeCell(row.jointName),
          escapeCell(row.bone),
          row.x === null ? "" : String(row.x),
          row.y === null ? "" : String(row.y),
          row.z === null ? "" : String(row.z),
          row.present ? "yes" : "no",
        ].join(","),
      );
    });
  });

  return rows.join("\r\n") + "\r\n";
}

/**
 * Reads the shared skeleton coordinate CSV format.
 *
 * The bone and present columns are supported, while older CSVs
 * without those columns can still be imported.
 */
export function parseCoordinateCsv(
  text: string,
): CoordinateCsvParseResult {
  const rows = parseRows(text);
  const warnings: string[] = [];

  if (rows.length < 2) {
    return {
      records: [],
      warnings: ["The CSV contains no coordinate rows."],
    };
  }

  const graveyardRow = rows.find(
    (row) =>
      normaliseName(row[0] ?? "") === "graveyard_name",
  );

  const graveyardName =
    graveyardRow?.[1]?.trim() || undefined;

  const headerIndex = rows.findIndex(
    (row) =>
      normaliseName(row[0] ?? "") === "skeleton_id",
  );

  if (headerIndex < 0) {
    return {
      graveyardName,
      records: [],
      warnings: [
        "The CSV must contain skeleton_id, joint_name, x, y, and z columns.",
      ],
    };
  }

  const headers = rows[headerIndex].map(normaliseName);

  const find = (...names: string[]) =>
    headers.findIndex((header) => names.includes(header));

  const skeletonIndex = find(
    "skeleton_id",
    "skeleton",
    "body_id",
    "bp",
    "context",
  );

  const jointIndex = find(
    "joint_name",
    "joint",
    "point",
    "landmark",
  );

  const xIndex = find("x");
  const yIndex = find("y");
  const zIndex = find("z");

  const boneIndex = find(
    "bone",
    "bone_label",
    "contributor",
  );

  const presentIndex = find(
    "present",
    "presence",
  );

  if (
    [skeletonIndex, jointIndex, xIndex, yIndex, zIndex]
      .some((index) => index < 0)
  ) {
    return {
      graveyardName,
      records: [],
      warnings: [
        "The CSV must contain skeleton_id, joint_name, x, y, and z columns.",
      ],
    };
  }

  const records = new Map<string, CoordinateCsvRow[]>();

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = headerIndex + offset + 2;

    const skeletonId =
      row[skeletonIndex]?.trim();

    const jointName =
      row[jointIndex]?.trim();

    if (!skeletonId) {
      warnings.push(
        `Row ${rowNumber} has no skeleton_id and was skipped.`,
      );
      return;
    }

    if (!jointName) {
      warnings.push(
        `Row ${rowNumber} has no joint_name and was skipped.`,
      );
      return;
    }

    const x = parseCoordinate(row[xIndex] ?? "");
    const y = parseCoordinate(row[yIndex] ?? "");
    const z = parseCoordinate(row[zIndex] ?? "");

    const bone =
      boneIndex >= 0
        ? row[boneIndex]?.trim() ?? ""
        : "";

    const presentValue =
      presentIndex >= 0
        ? row[presentIndex]?.trim().toLowerCase()
        : undefined;

    const present =
      presentValue === undefined
        ? true
        : !["no", "false", "0"].includes(presentValue);

    const coordinateRow: CoordinateCsvRow = {
      skeletonId,
      jointName,
      bone,
      x,
      y,
      z,
      present,
    };

    const existing =
      records.get(skeletonId) ?? [];

    existing.push(coordinateRow);
    records.set(skeletonId, existing);
  });

  return {
    graveyardName,
    records: [...records.entries()].map(
      ([name, rows]) => ({
        name,
        rows,
      }),
    ),
    warnings,
  };
}