/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Makes imported skeleton names unique by adding a numbered suffix.
 */

/** Returns `name`, or `name (1)`, `name (2)` and so on, until it is not in `usedNames`. Records the result in `usedNames`. */
export function uniqueRecordName(name: string, usedNames: Set<string>): string {
  const base = name.trim() || 'Untitled skeleton';
  let candidate = base;
  let suffix = 1;
  while (usedNames.has(candidate.toLowerCase())) {
    candidate = `${base} (${suffix})`;
    suffix += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}
