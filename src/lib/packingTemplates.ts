export function newPackingTexts(existing: string[], texts: string[]): string[] {
  const known = new Set(existing.map((text) => text.trim()))
  return [...new Set(texts.map((text) => text.trim()).filter(Boolean))].filter((text) => !known.has(text))
}
