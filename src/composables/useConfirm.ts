import { ref } from 'vue'

export interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
}

interface PendingConfirm extends ConfirmRequest {
  resolve: (confirmed: boolean) => void
}

const pending = ref<PendingConfirm | null>(null)

/**
 * App-wide replacement for `window.confirm()`. Renders through `ConfirmHost`,
 * so a destructive action looks like the rest of the app instead of a
 * browser chrome dialog that blocks the page.
 */
export function useConfirm() {
  function confirm(request: ConfirmRequest): Promise<boolean> {
    // A second request supersedes the first rather than stacking dialogs.
    pending.value?.resolve(false)

    return new Promise<boolean>((resolve) => {
      pending.value = { ...request, resolve }
    })
  }

  function answer(confirmed: boolean): void {
    pending.value?.resolve(confirmed)
    pending.value = null
  }

  return { pending, confirm, answer }
}
