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
