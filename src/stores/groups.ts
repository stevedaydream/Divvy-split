import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { watchMyGroups } from '@/services/groups'
import { watchHiddenGroups } from '@/services/groupPreferences'
import type { Group } from '@/types/models'

/**
 * Live list of the signed-in user's groups.
 *
 * This used to be a one-shot `getDocs` inside the dashboard, so a group
 * created or renamed on another device never showed up. It is a snapshot
 * listener now, matching how the group detail screen already behaved.
 */
export const useGroupsStore = defineStore('groups', () => {
  const groups = ref<Group[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const hiddenIds = ref<string[]>([])

  let unsubscribe: (() => void) | null = null
  let watchedUid: string | null = null
  let stopHidden: (() => void) | null = null

  const active = computed(() => groups.value.filter((g) => !g.archived && !hiddenIds.value.includes(g.id)))
  const archived = computed(() => groups.value.filter((g) => g.archived && !hiddenIds.value.includes(g.id)))
  const hidden = computed(() => groups.value.filter((g) => hiddenIds.value.includes(g.id)))
  const byId = computed(() => new Map(groups.value.map((g) => [g.id, g])))

  function subscribe(uid: string): void {
    if (watchedUid === uid && unsubscribe) return
    unsubscribe?.()
    stopHidden?.()
    hiddenIds.value = []

    watchedUid = uid
    loading.value = true
    error.value = null
    stopHidden = watchHiddenGroups(uid, (ids) => { hiddenIds.value = ids }, (cause) => { error.value = cause.message })

    unsubscribe = watchMyGroups(
      uid,
      (next) => {
        groups.value = next.sort((a, b) => a.name.localeCompare(b.name))
        loading.value = false
      },
      (cause) => {
        error.value = cause.message
        loading.value = false
      },
    )
  }

  function reset(): void {
    unsubscribe?.()
    stopHidden?.()
    stopHidden = null
    hiddenIds.value = []
    unsubscribe = null
    watchedUid = null
    groups.value = []
    loading.value = true
    error.value = null
  }

  return { groups, loading, error, active, archived, hidden, byId, subscribe, reset }
})
