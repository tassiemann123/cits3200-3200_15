import type { Landmark, ParseResult, Segment, SkeletonLayer, Vec3 } from "../types";
import { legacyColor, paletteColor, rgbToHex } from "./colors";
import { surveyToWorld } from "./coordinates";

interface WorkingLayer {
  name: string;
  segments: Segment[];
  landmarks: Landmark[];
  color?: string;
  previous?: Vec3;
  pointCount: number;
}

function layerNameFromComment(comment: string): string | null {
  const body = comment.match(/\bBP\s*0*(\d+)\b/i);
  if (body) return `BP${body[1]}`;
  if (/fossa|grave.*outline|outline.*grave/i.test(comment)) return "Grave outline";
  if (/north\s*arrow/i.test(comment)) return "North arrow";
  return null;
}

function makeWorkingLayer(name: string): WorkingLayer {
  return { name, segments: [], landmarks: [], pointCount: 0 };
}

export function parseRot(text: string, sourceName = "Imported ROT"): ParseResult {
  const warnings: string[] = [];
  const completed: WorkingLayer[] = [];
  let current: WorkingLayer | null = null;

  const finishCurrent = () => {
    if (current && (current.segments.length > 0 || current.landmarks.length > 0)) completed.push(current);
  };

  text.split(/\r?\n/).forEach((rawLine, rowIndex) => {
    const trimmed = rawLine.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("#")) {
      const nextName = layerNameFromComment(trimmed.slice(1).trim());
      if (nextName && nextName !== current?.name) {
        finishCurrent();
        current = makeWorkingLayer(nextName);
      }
      return;
    }

    if (/^s\s+/i.test(trimmed)) return;
    const instruction = trimmed.split("#", 1)[0].trim();
    const numbers = instruction.split(/\s+/).map(Number);
    if (numbers.length < 4 || numbers.some((value) => !Number.isFinite(value))) {
      warnings.push(`Row ${rowIndex + 1} could not be parsed and was skipped.`);
      return;
    }

    if (!current) current = makeWorkingLayer("Unlabelled");
    const [x, z, y] = numbers;
    const position = surveyToWorld(x, z, y);
    const colorValues = numbers.slice(3);
    const code = colorValues[0];
    current.pointCount += 1;
    current.landmarks.push({
      id: `${current.name}-p${current.pointCount}`,
      label: `Point ${current.pointCount}`,
      position,
    });

    if (!current.color && code !== 0) {
      current.color = colorValues.length >= 3
        ? rgbToHex(colorValues[0], colorValues[1], colorValues[2])
        : legacyColor(code, completed.length);
    }

    if (code < 0) return;
    if (code === 0) {
      current.previous = position;
      return;
    }
    if (current.previous) current.segments.push({ from: current.previous, to: position });
    current.previous = position;
  });

  finishCurrent();
  const layers: SkeletonLayer[] = completed.map((layer, index) => ({
    id: `${sourceName.replace(/\W+/g, "-").toLowerCase()}-${layer.name.toLowerCase().replace(/\W+/g, "-")}-${index}`,
    name: layer.name,
    sourceName,
    color: layer.color ?? paletteColor(index),
    visible: true,
    locked: /grave outline|north arrow/i.test(layer.name),
    modelType: "landmarks",
    segments: layer.segments,
    landmarks: layer.landmarks,
    notes: "",
  }));

  if (layers.length === 0) warnings.push("No displayable ROT coordinates were found. Check that the file uses the X Z Y colour format.");
  return { layers, warnings };
}
