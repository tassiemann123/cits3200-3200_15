/** Keep decimal input literal: the sign never changes the units or magnitude. */
export function parseCoordinateInput(text: string): number | null {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

export function toggleCoordinateSign(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("-") ? trimmed.slice(1) : `-${trimmed.replace(/^\+/, "")}`;
}
