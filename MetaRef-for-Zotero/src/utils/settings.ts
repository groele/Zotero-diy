export function settingsTokens(query: string): string[] {
  return query.normalize("NFKC").toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
}

export function matchesSettings(text: string, tokens: string[]): boolean {
  const normalized = text.normalize("NFKC").toLocaleLowerCase();
  return tokens.every(token => normalized.includes(token));
}

export function validConcurrency(raw: string): number | null {
  if (!raw.trim())
    return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 16 ? value : null;
}
