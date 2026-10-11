/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Colour helpers. Holds the accessible 20 colour palette used to tell
 * skeletons apart, and conversion of older colour codes to hex.
 */

/** Colours chosen to stay distinguishable from each other. */
const ACCESSIBLE_PALETTE = [
  '#2FC7B1',
  '#F18745',
  '#A8301C',
  '#763F08',
  '#4EA72E',
  '#B5D628',
  '#ED3C05',
  '#5DFDF9',
  '#2790CB',
  '#1D52BD',
  '#715BF3',
  '#5795A3',
  '#9910D6',
  '#E97132',
  '#B01AB8',
  '#E33DCB',
  '#ED8BDF',
  '#753825',
  '#32911F',
  '#DEAA36',
];

/** Returns the palette colour for a skeleton index, wrapping around. */
export function paletteColor(index: number): string {
  return ACCESSIBLE_PALETTE[index % ACCESSIBLE_PALETTE.length];
}

/** Converts 0 to 255 red, green and blue values to a #RRGGBB string. */
export function rgbToHex(red: number, green: number, blue: number): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.abs(value)))
      .toString(16)
      .padStart(2, '0');

  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

/** Converts an older numeric colour code from saved data to hex, falling back to the palette. */
export function legacyColor(code: number, fallbackIndex: number): string {
  return [
    '#E7E9E4',
    '#D94132',
    '#46A758',
    '#3A72D8',
    '#E0B735',
    '#8C55B8',
    '#2AB7B0',
    '#E7E9E4',
  ][Math.abs(code)] ?? paletteColor(fallbackIndex);
}