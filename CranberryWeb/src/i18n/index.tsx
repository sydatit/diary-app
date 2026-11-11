import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { makeFmt, type Fmt } from '../lib/date'
import { en, type TKey } from './en'
import { vi } from './vi'

export type { TKey } from './en'
export type Lang = 'en' | 'vi'
export type LangPref = 'system' | Lang
export type TFunc = (key: TKey, vars?: Record<string, string | number>) => string

const KEY = 'unplug.lang'
const DICTS: Record<Lang, Record<TKey, string>> = { en, vi }
const LOCALES: Record<Lang, string> = { en: 'en-US', vi: 'vi-VN' }

function readPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'en' || v === 'vi' ? v : 'system'
  } catch {
    return 'system'
  }
}

function browserLang(): Lang {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
  return langs.some((l) => l?.toLowerCase().startsWith('vi')) ? 'vi' : 'en'
}

function makeT(lang: Lang): TFunc {
  const dict = DICTS[lang]
  return (key, vars) => {
    const s = dict[key] ?? en[key] ?? key
    return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s
  }
}

interface I18nState {
  lang: Lang
  pref: LangPref
  setPref: (p: LangPref) => void
  t: TFunc
  locale: string
  fmt: Fmt
}

const I18nContext = createContext<I18nState | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [pref, setPrefState] = useState<LangPref>(readPref)
  const lang: Lang = pref === 'system' ? browserLang() : pref

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setPref = useCallback((p: LangPref) => {
    setPrefState(p)
    try {
      if (p === 'system') localStorage.removeItem(KEY)
      else localStorage.setItem(KEY, p)
    } catch {
      /* storage unavailable: still applies for this session */
    }
  }, [])

  const value = useMemo<I18nState>(() => {
    const locale = LOCALES[lang]
    return { lang, pref, setPref, t: makeT(lang), locale, fmt: makeFmt(locale) }
  }, [lang, pref, setPref])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside LanguageProvider')
  return ctx
}

const CODES = new Set(['Invalid', 'Expired', 'TooManyAttempts', 'AlreadyVerified', 'EmailNotConfirmed', 'DuplicateDate'])

/**
 * Readable, translated text for a thrown error: known API codes and client-side errors are translated,
 * other server messages (e.g. password rules from Identity) are shown as the server wrote them.
 */
export function errorText(err: unknown, t: TFunc, fallback: TKey = 'error.generic'): string {
  if (err instanceof ApiError) {
    if (err.code && CODES.has(err.code)) return t(`error.code.${err.code}` as TKey)
    if (err.key) return t(err.key as TKey)
  }
  return err instanceof Error && err.message ? err.message : t(fallback)
}
