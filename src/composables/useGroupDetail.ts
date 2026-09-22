import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import { watchGroup } from '@/services/groups'
import { watchEntries } from '@/services/entries'
import { computeBalances, computeSettlements, totalSpend } from '@/lib/settlement'
import type { Entry, Group } from '@/types/models'

/**
 * Subscribes to one group and its ledger, and derives balances from them.
 *
 * Both listeners are torn down when the effect scope ends, which the previous
 * screen never did — leaving a Firestore listener running after navigating away.
 */
export function useGroupDetail(groupId: Ref<string>) {
  const group = ref<Group | null>(null)
  const entries = ref<Entry[]>([])
  const loadingGroup = ref(true)
  const loadingEntries = ref(true)
  const error = ref<string | null>(null)

  let stopGroup: (() => void) | null = null
  let stopEntries: (() => void) | null = null

  function teardown(): void {
    stopGroup?.()
    stopEntries?.()
    stopGroup = null
    stopEntries = null
  }

  watch(
    groupId,
    (id) => {
      teardown()
      if (!id) return

      loadingGroup.value = true
      loadingEntries.value = true
      error.value = null

      stopGroup = watchGroup(
        id,
        (next) => {
          group.value = next
          loadingGroup.value = false
        },
        (cause) => {
          error.value = cause.message
          loadingGroup.value = false
        },
      )

      stopEntries = watchEntries(
        id,
        (next) => {
          entries.value = next
          loadingEntries.value = false
        },
        (cause) => {
          error.value = cause.message
          loadingEntries.value = false
        },
      )
    },
    { immediate: true },
  )

  onScopeDispose(teardown)

  const memberIds = computed(() => group.value?.memberIds ?? [])
  const balances = computed(() => computeBalances(entries.value, memberIds.value))
  const settlements = computed(() => computeSettlements(balances.value))
  const total = computed(() => totalSpend(entries.value))
  const loading = computed(() => loadingGroup.value || loadingEntries.value)

  return { group, entries, balances, settlements, total, loading, error }
}
