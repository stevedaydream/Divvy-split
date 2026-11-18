import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

const stack: HTMLElement[] = []
let previousOverflow = ''

/** Shared by sheets and confirmations so nested overlays keep keyboard focus. */
export function useModalFocus(open: () => boolean, panel: Ref<HTMLElement | null>, close: () => void) {
  let activePanel: HTMLElement | null = null
  let trigger: HTMLElement | null = null
  const focusables = () => Array.from(activePanel?.querySelectorAll<HTMLElement>(
    'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
  ) ?? []).filter(element => element.getClientRects().length && !element.closest('[inert]'))

  function onKeydown(event: KeyboardEvent) {
    if (!activePanel || stack[stack.length - 1] !== activePanel) return
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return }
    if (event.key !== 'Tab') return
    const items = focusables()
    const first = items[0]
    const last = items[items.length - 1]
    if (!first) { event.preventDefault(); activePanel.focus(); return }
    if (event.shiftKey && (document.activeElement === activePanel || document.activeElement === first || !activePanel.contains(document.activeElement))) {
      event.preventDefault(); last?.focus()
    } else if (!event.shiftKey && (document.activeElement === activePanel || document.activeElement === last || !activePanel.contains(document.activeElement))) {
      event.preventDefault(); first.focus()
    }
  }
  function release() {
    if (!activePanel) return
    const wasTop = stack[stack.length - 1] === activePanel
    const index = stack.indexOf(activePanel)
    if (index !== -1) stack.splice(index, 1)
    document.removeEventListener('keydown', onKeydown)
    if (!stack.length) document.body.style.overflow = previousOverflow
    if (wasTop && trigger?.isConnected) trigger.focus({ preventScroll: true })
    activePanel = null
  }
  watch(open, async value => {
    if (!value) { release(); return }
    trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (!open() || !panel.value) return
    activePanel = panel.value
    if (!stack.length) previousOverflow = document.body.style.overflow
    stack.push(activePanel)
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeydown)
    activePanel.focus({ preventScroll: true })
  }, { immediate: true })
  onBeforeUnmount(release)
}
