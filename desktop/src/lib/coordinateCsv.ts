/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Reads and writes the shared CSV format used by both the mobile and desktop
 * apps. Columns are skeleton_id, joint_name, bone, x, y, z, present, with a
 * "Graveyard Name" row first. Parsing accepts older column names, never throws on
 * bad rows, and instead skips them with a warning that includes the line number.
 */

/**
 Shared CSV format used by both the mobile and desktop applications.

 Format:
 Graveyard Name,<name>
 skeleton_id,joint_name,bone,x,y,z,present
 */

/** One CSV data row. */
export interface CoordinateCsvRow {
  /** Line where this CSV row begins, for actionable import warnings. */
  lineNumber?: number;
  skeletonId: string;
  jointName: string;
  bone: string;
  x: number | null;
  y: number | null;
  z: number | null;
  present: boolean;
}

/** All rows belonging to one skeleton. */
export interface CoordinateCsvRecord {
  name: string;
  rows: CoordinateCsvRow[];
}

/** Parsed skeletons, the graveyard name if present, and warnings for rows that were skipped. */
export interface CoordinateCsvParseResult {
  graveyardName?: string;
  records: CoordinateCsvRecord[];
  warnings: string[];
}

/** Splits CSV text into rows, handling quoted cells, commas and line breaks inside quotes, and records the starting line of each row. */
function parseRows(text: string): { rows: string[][]; lineNumbers: number[] } {
  const rows: string[][] = [];
  const lineNumbers: number[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let lineNumber = 1;
  let rowStartLine = 1;

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
        lineNumbers.push(rowStartLine);
      }

      row = [];
      cell = "";
      lineNumber += 1;
      rowStartLine = lineNumber;
    } else {
      cell += character;
      if (character === "\r" || (character === "\n" && text[index - 1] !== "\r")) lineNumber += 1;
    }
  }

  row.push(cell.trim());

  if (row.some(Boolean)) {
    rows.push(row);
    lineNumbers.push(rowStartLine);
  }

  return { rows, lineNumbers };
}

/** Lower-cases a header and turns spaces and punctuation into underscores so variations match. */
function normaliseName(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Quotes a cell if it contains a comma, quote or line break. */
function escapeCell(value: string): string {
  return /[",\r\n]/.test(value)
    ? `"${value.replace(/"/g, '""')}"`
    : value;
}

/** Converts text to a number, or null if blank or not a finite number. */
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
  const { rows, lineNumbers } = parseRows(text);
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
        "No skeleton_id header was found. Expected a header row with skeleton_id, joint_name, x, y, and z.",
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
    const missing = [
      [skeletonIndex, "skeleton_id"],
      [jointIndex, "joint_name"],
      [xIndex, "x"],
      [yIndex, "y"],
      [zIndex, "z"],
    ].filter(([index]) => index === -1).map(([, name]) => name);
    return {
      graveyardName,
      records: [],
      warnings: [
        `Missing required CSV column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`,
      ],
    };
  }

  const records = new Map<string, CoordinateCsvRow[]>();

  rows.slice(headerIndex + 1).forEach((row, offset) => {
    const rowNumber = lineNumbers[headerIndex + offset + 1];

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

    if (presentValue && !["yes", "true", "1", "no", "false", "0"].includes(presentValue)) {
      warnings.push(`Row ${rowNumber} has an invalid present value "${presentValue}" and was skipped. Use yes or no.`);
      return;
    }

    const present =
      presentValue === undefined
        ? true
        : !["no", "false", "0"].includes(presentValue);

    if (present && [x, y, z].some((value) => value === null)) {
      const invalid = (["x", "y", "z"] as const).filter((_, index) => [x, y, z][index] === null);
      warnings.push(`Row ${rowNumber} (${skeletonId}, ${jointName}) has missing or invalid ${invalid.join(", ")} coordinate${invalid.length === 1 ? "" : "s"} and was skipped.`);
      return;
    }

    const coordinateRow: CoordinateCsvRow = {
      lineNumber: rowNumber,
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
