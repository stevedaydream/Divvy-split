<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Pencil, Trash2, UserCheck } from 'lucide-vue-next'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { activeGuestIds, claimConflicts, GUEST_NAME_MAX, guestInUse } from '@/lib/guests'
import { addGuest, claimGuest, removeGuest, renameGuest } from '@/services/groups'
import type { Entry, Group } from '@/types/models'

/**
 * Manages a group's virtual members. Opened with `claiming` right after
 * someone joins, so they can say which guest they were.
 */
const props = defineProps<{
  open: boolean
  group: Group
  uid: string
  /** Entries as stored, before claimed guests are resolved. */
  entries: Entry[]
  claiming?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { confirm } = useConfirm()
const toast = useToast()

const name = ref('')
const editing = ref<string | null>(null)
const editName = ref('')
const busy = ref(false)

watch(() => props.open, (open) => {
  if (!open) return
  name.value = ''
  editing.value = null
})

const guestIds = computed(() => activeGuestIds(props.group.guests))
const editable = computed(() => !props.group.archived)
/** One account claims at most one guest; a second claim is almost always a mis-tap. */
const alreadyClaimed = computed(() => Object.values(props.group.guests).some((guest) => guest.linkedUid === props.uid))

async function run(action: () => Promise<void>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    busy.value = false
  }
}

function add(): void {
  const nickname = name.value.trim()
  if (!nickname) return
  void run(async () => {
    await addGuest(props.group.id, nickname)
    name.value = ''
    toast.success(t('guest.added', { name: nickname }))
  })
}

function startRename(id: string): void {
  editing.value = id
  editName.value = props.group.guests[id]?.nickname ?? ''
}

function saveRename(id: string): void {
  const nickname = editName.value.trim()
  if (!nickname) return
  void run(async () => {
    await renameGuest(props.group.id, id, nickname)
    editing.value = null
  })
}

async function remove(id: string): Promise<void> {
  const nickname = props.group.guests[id]?.nickname ?? ''
  if (guestInUse(props.entries, id)) {
    toast.error(t('guest.inUse', { name: nickname }))
    return
  }
  const confirmed = await confirm({ title: t('guest.removeTitle', { name: nickname }), confirmLabel: t('common.delete'), tone: 'danger' })
  if (confirmed) await run(() => removeGuest(props.group.id, id))
}

async function claim(id: string): Promise<void> {
  const nickname = props.group.guests[id]?.nickname ?? ''
  const conflicts = claimConflicts(props.entries, id, props.uid)
  if (conflicts.length) {
    toast.error(t('guest.claimConflict', { name: nickname, count: conflicts.length }))
    return
  }
  const confirmed = await confirm({
    title: t('guest.claimTitle', { name: nickname }),
    message: t('guest.claimMessage', { name: nickname }),
    confirmLabel: t('guest.claim'),
  })
  if (!confirmed) return
  await run(async () => {
    await claimGuest(props.group.id, id, props.uid)
    toast.success(t('guest.claimed', { name: nickname }))
    emit('close')
  })
}
</script>

<template>
  <AppSheet :open="open" :title="claiming ? t('guest.claimHeading') : t('guest.title')" @close="emit('close')">
    <p class="-mt-1 mb-5 text-xs leading-relaxed text-muted">
      {{ claiming ? t('guest.claimHint') : t('guest.hint') }}
    </p>

    <ul v-if="guestIds.length" class="space-y-2">
      <li v-for="id in guestIds" :key="id" class="flex items-center gap-3 rounded-card border border-border p-3">
        <AppAvatar :name="group.guests[id]!.nickname" size="sm" />
        <form v-if="editing === id" class="flex min-w-0 flex-1 gap-2" @submit.prevent="saveRename(id)">
          <AppInput v-model="editName" :placeholder="t('guest.namePlaceholder')" />
          <AppButton type="submit" size="sm" :loading="busy">{{ t('common.save') }}</AppButton>
        </form>
        <template v-else>
          <span class="min-w-0 flex-1 truncate text-sm">{{ group.guests[id]!.nickname }}</span>
          <AppButton v-if="!alreadyClaimed" size="sm" :variant="claiming ? 'primary' : 'secondary'" :disabled="busy" @click="claim(id)">
            <UserCheck class="size-4" />{{ t('guest.claim') }}
          </AppButton>
          <template v-if="editable && !claiming">
            <button type="button" class="ui-control grid size-8 place-items-center rounded-lg text-muted hover:text-fg" :aria-label="t('common.edit')" @click="startRename(id)">
              <Pencil class="size-4" />
            </button>
            <button type="button" class="ui-control grid size-8 place-items-center rounded-lg text-muted hover:text-negative" :aria-label="t('common.delete')" @click="remove(id)">
              <Trash2 class="size-4" />
            </button>
          </template>
        </template>
      </li>
    </ul>
    <p v-else class="text-sm text-faint">{{ t('guest.empty') }}</p>

    <form v-if="editable && !claiming" class="mt-5 flex gap-2" @submit.prevent="add">
      <AppInput v-model="name" :placeholder="t('guest.namePlaceholder')" :maxlength="GUEST_NAME_MAX" />
      <AppButton type="submit" :loading="busy" :disabled="!name.trim()">{{ t('guest.add') }}</AppButton>
    </form>

    <AppButton v-if="claiming" class="mt-5" variant="ghost" block @click="emit('close')">{{ t('guest.notMe') }}</AppButton>
  </AppSheet>
</template>
