import { createI18n } from 'vue-i18n'
import en from './en'
import zhTW from './zh-TW'

export type Locale = 'en' | 'zh-TW'

const STORAGE_KEY = 'divvy:locale'

function initialLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'zh-TW') return saved
  } catch { /* storage unavailable */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-TW' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { en, 'zh-TW': zhTW },
})

export function setLocale(locale: Locale): void {
  i18n.global.locale.value = locale
  document.documentElement.lang = locale
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch { /* storage unavailable */ }
}

export function currentLocale(): Locale {
  return i18n.global.locale.value as Locale
}
