import { describe, expect, it } from 'vitest'
import { en } from './en'
import { vi as viDict } from './vi'
import { errorText, type TFunc } from '.'
import { ApiError } from '../api/client'

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()

describe('translations', () => {
  it('Vietnamese has exactly the English keys', () => {
    expect(Object.keys(viDict).sort()).toEqual(Object.keys(en).sort())
  })

  it('every translation keeps the same {placeholders}', () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(viDict[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it('no translation is empty', () => {
    for (const [key, value] of Object.entries(viDict)) expect(value.trim(), key).not.toBe('')
  })
})

describe('errorText', () => {
  const t = ((key: string) => `T:${key}`) as TFunc

  it('translates known API codes', () => {
    expect(errorText(new ApiError(409, 'dup', { code: 'DuplicateDate' }), t)).toBe('T:error.code.DuplicateDate')
  })

  it('translates client-side errors by key', () => {
    expect(errorText(new ApiError(0, 'offline', undefined, 'error.network'), t)).toBe('T:error.network')
  })

  it('shows other server messages as written', () => {
    expect(errorText(new ApiError(400, 'Passwords must have a digit.'), t)).toBe('Passwords must have a digit.')
  })

  it('falls back when there is no message', () => {
    expect(errorText('weird', t, 'settings.saveFailed')).toBe('T:settings.saveFailed')
  })
})
