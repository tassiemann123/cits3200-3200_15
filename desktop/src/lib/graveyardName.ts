/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * Checks whether a graveyard name is already used, ignoring case and surrounding spaces.
 */

/** True if another graveyard (not `exceptId`) already has this name. */
export function graveyardNameExists(
  name: string,
  graveyards: { id: string; name: string }[],
  exceptId?: string,
): boolean {
  const wanted = name.trim().toLowerCase();
  return graveyards.some(graveyard =>
    graveyard.id !== exceptId && graveyard.name.trim().toLowerCase() === wanted,
  );
}
