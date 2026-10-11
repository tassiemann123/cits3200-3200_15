/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Parsing and sign-toggling for the text in a coordinate entry field --
 * see components/CoordinateInput.tsx.
 */

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
