// `\b` does not understand Vietnamese letters with diacritics, so word edges are `\p{L}` lookarounds.
const RULES: [RegExp, string][] = [
  [/(?<!\p{L})cha\s+mẹ(?!\p{L})/giu, 'Cha Mẹ'],
  [/(?<!\p{L})(?:si|xi)[\s-]*ôn(?!\p{L})/giu, 'Sion'],
  [/(?<!\p{L})sion(?!\p{L})/giu, 'Sion'],
]

/** Fix spellings the AI tends to get wrong: "cha mẹ" -> "Cha Mẹ", "si ôn" -> "Sion". */
export function normalizeVoiceText(text: string): string {
  return RULES.reduce((s, [re, to]) => s.replace(re, to), text.normalize('NFC'))
}

/** Append each non-empty line of `addition` to the end of `current`, one idea per line. */
export function appendLines(current: string, addition: string): string {
  const lines = addition
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim())
  if (!lines.length) return current
  const head = current.replace(/\s+$/, '')
  return head ? `${head}\n${lines.join('\n')}` : lines.join('\n')
}
