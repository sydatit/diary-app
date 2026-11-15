import { describe, expect, it } from 'vitest'
import { appendLines, normalizeVoiceText } from './voiceText'

describe('normalizeVoiceText', () => {
  it('capitalises Cha Mẹ and fixes Sion', () => {
    expect(normalizeVoiceText('hôm nay cha mẹ đến si ôn')).toBe('hôm nay Cha Mẹ đến Sion')
    expect(normalizeVoiceText('xi-ôn và SION')).toBe('Sion và Sion')
  })

  it('does not touch words that only contain the pattern', () => {
    expect(normalizeVoiceText('passion')).toBe('passion')
  })

  it('handles decomposed (NFD) Vietnamese input', () => {
    expect(normalizeVoiceText('cha mẹ')).toBe('Cha Mẹ')
  })
})

describe('appendLines', () => {
  it('appends each non-empty line on its own line', () => {
    expect(appendLines('- one', '- two\n\n- three  ')).toBe('- one\n- two\n- three')
  })

  it('starts fresh in an empty box and ignores blank additions', () => {
    expect(appendLines('', '- a')).toBe('- a')
    expect(appendLines('- a', '  \n ')).toBe('- a')
  })

  it('drops trailing whitespace before appending', () => {
    expect(appendLines('- a\n\n', '- b')).toBe('- a\n- b')
  })
})
