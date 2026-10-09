export function availableGraveyardName(
  name: string,
  graveyards: { id: string; name: string }[],
  exceptId?: string,
): string {
  const used = new Set(graveyards
    .filter(graveyard => graveyard.id !== exceptId)
    .map(graveyard => graveyard.name.trim().toLowerCase()));
  const base = name.trim();
  let candidate = base;
  let number = 1;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} (${number})`;
    number += 1;
  }
  return candidate;
}
