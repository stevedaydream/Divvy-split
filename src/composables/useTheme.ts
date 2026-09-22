import { ref } from 'vue'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'divvy:theme'

function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function stored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

const theme = ref<Theme>(stored() ?? systemTheme())
const followsSystem = ref(stored() === null)

function apply(next: Theme): void {
  theme.value = next
  document.documentElement.dataset.theme = next
}

// Keep following the OS until the user makes an explicit choice.
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
  if (followsSystem.value) apply(event.matches ? 'dark' : 'light')
})

export function useTheme() {
  function setTheme(next: Theme): void {
    followsSystem.value = false
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch { /* storage unavailable — the choice lasts for this session only */ }
    apply(next)
  }

  function toggle(): void {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function useSystem(): void {
    followsSystem.value = true
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch { /* ignore */ }
    apply(systemTheme())
  }

  return { theme, followsSystem, setTheme, toggle, useSystem }
}
