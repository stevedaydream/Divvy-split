<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Mail } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { acceptInvitation, declineInvitation, watchMyInvitations } from '@/services/invitations'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { Invitation } from '@/types/models'

/** Pending invitations for the signed-in user, shown above their groups. */
const { t } = useI18n()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const invitations = ref<Invitation[]>([])
const busy = ref<string | null>(null)
let stop: (() => void) | null = null

watch(
  () => auth.uid,
  (uid) => {
    stop?.()
    stop = null
    invitations.value = []
    if (uid) stop = watchMyInvitations(uid, (next) => (invitations.value = next))
  },
  { immediate: true },
)
onScopeDispose(() => stop?.())

async function accept(invitation: Invitation): Promise<void> {
  const uid = auth.uid
  const profile = auth.profile
  if (!uid || !profile) return
  busy.value = invitation.id
  try {
    const result = await acceptInvitation(invitation, { nickname: profile.nickname, payment: profile.payment }, uid)
    if (result === 'joined') {
      toast.success(t('invite.joined', { name: invitation.groupName }))
      await router.push({ name: 'group', params: { id: invitation.groupId } })
    } else {
      toast.info(result === 'not-found' ? t('invite.notFound') : t('invite.invalid'))
    }
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    busy.value = null
  }
}

async function decline(invitation: Invitation): Promise<void> {
  busy.value = invitation.id
  try {
    await declineInvitation(invitation)
  } catch {
    toast.error(t('common.somethingWrong'))
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section v-if="invitations.length" class="mb-5 space-y-2">
    <article
      v-for="invitation in invitations"
      :key="invitation.id"
      class="rounded-card border border-accent/40 bg-accent-soft/40 p-4"
    >
      <p class="flex items-start gap-2 text-sm">
        <Mail class="mt-0.5 size-4 shrink-0 text-accent" />
        <span>{{ t('invite.received', { from: invitation.fromName || t('common.unknown'), name: invitation.groupName }) }}</span>
      </p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <AppButton size="sm" variant="secondary" :disabled="busy === invitation.id" @click="decline(invitation)">
          {{ t('invite.decline') }}
        </AppButton>
        <AppButton size="sm" :loading="busy === invitation.id" @click="accept(invitation)">
          {{ t('invite.accept') }}
        </AppButton>
      </div>
    </article>
  </section>
</template>
