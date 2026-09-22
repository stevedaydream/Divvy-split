import { ref } from 'vue'

export type ToastTone = 'info' | 'success' | 'error'

export interface Toast {
  id: number
  message: string
  tone: ToastTone
}

const toasts = ref<Toast[]>([])
let nextId = 0

function push(message: string, tone: ToastTone, durationMs: number): void {
  const id = nextId++
  toasts.value = [...toasts.value, { id, message, tone }]
  setTimeout(() => dismiss(id), durationMs)
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

/** App-wide replacement for `alert()` — non-blocking and themed. */
export function useToast() {
  return {
    toasts,
    dismiss,
    info: (message: string, durationMs = 3200) => push(message, 'info', durationMs),
    success: (message: string, durationMs = 3200) => push(message, 'success', durationMs),
    error: (message: string, durationMs = 5000) => push(message, 'error', durationMs),
  }
}
