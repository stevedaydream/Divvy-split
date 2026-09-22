<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Share2 } from 'lucide-vue-next'
import AppAvatar from '@/components/ui/AppAvatar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import { listContacts } from '@/services/contacts'
import { sendInvitation, watchSentInvitations } from '@/services/invitations'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useInvite } from '@/composables/useInvite'
import { useToast } from '@/composables/useToast'
import type { Group, Invitation } from '@/types/models'

const props = defineProps<{ open: boolean; group: Group }>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const auth = useAuthStore()
const groups = useGroupsStore()
const toast = useToast()
const { invite } = useInvite()

const sent = ref<Invitation[]>([])
const sending = ref<string | null>(null)
let stop: (() => void) | null = null

// Only listen while the sheet is open; it is a small, short-lived view.
watch(
  () => props.open,
  (open) => {
    stop?.()
    stop = null
    const uid = auth.uid
    if (!open || !uid) return
    groups.subscribe(uid)
    stop = watchSentInvitations(props.group.id, uid, (next) => {
      sent.value = next
    })
  },
  { immediate: true },
)
onScopeDispose(() => stop?.())

const contacts = computed(() => listContacts(groups.groups, auth.uid ?? '', props.group.memberIds))
const statusOf = computed(() => new Map(sent.value.map((i) => [i.toUid, i.status])))

async function send(uid: string, nickname: string): Promise<void> {
  const me = auth.uid
  if (!me) return
  sending.value = uid
  try {
    await sendInvitation(props.group, uid, { uid: me, name: auth.profile?.nickname ?? '' })
    toast.success(t('invite.sent', { name: nickname }))
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    sending.value = null
  }
}
</script>

<template>
  <AppSheet :open="open" :title="t('invite.action')" @close="emit('close')">
    <AppButton block @click="invite(group)">
      <template #icon><Share2 class="size-4" /></template>
      {{ t('invite.copy') }}
    </AppButton>
    <p class="mt-2 text-center text-[11px] text-faint">{{ t('invite.linkHint') }}</p>

    <section class="mt-7">
      <h3 class="text-xs font-medium text-muted">{{ t('invite.recent') }}</h3>
      <p class="mt-1 text-[11px] text-faint">{{ t('invite.recentHint') }}</p>

      <p v-if="!contacts.length" class="py-6 text-center text-xs text-faint">{{ t('invite.noRecent') }}</p>

      <ul v-else class="mt-3 space-y-1">
        <li v-for="contact in contacts" :key="contact.uid" class="flex items-center gap-3 py-1.5">
          <AppAvatar :name="contact.nickname" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ contact.nickname }}</span>
            <span class="block truncate text-[11px] text-faint">
              {{ t('invite.sharedGroup', { name: contact.sharedGroup }) }}
            </span>
          </span>
          <span
            v-if="statusOf.get(contact.uid) === 'pending'"
            class="inline-flex shrink-0 items-center gap-1 text-xs text-muted"
          >
            <Check class="size-3.5" /> {{ t('invite.pending') }}
          </span>
          <AppButton
            v-else
            size="sm"
            variant="secondary"
            :loading="sending === contact.uid"
            @click="send(contact.uid, contact.nickname)"
          >
            {{ statusOf.get(contact.uid) === 'declined' ? t('invite.again') : t('invite.send') }}
          </AppButton>
        </li>
      </ul>
    </section>
  </AppSheet>
</template>
