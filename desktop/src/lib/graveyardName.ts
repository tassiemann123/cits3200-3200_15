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
