<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Loader2 } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import { joinGroup } from '@/services/groups'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

/**
 * Handles `/join?g=<groupId>&c=<inviteCode>`.
 *
 * The invite used to be a bare group id parked in localStorage, which meant
 * anyone who saw a group id could add themselves. The secret code now travels
 * with the link and is verified by a security rule.
 */
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const toast = useToast()

const failure = ref<'invalid' | 'notFound' | 'retry' | null>(null)

function param(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

async function attempt(): Promise<void> {
  const groupId = param('g')
  const code = param('c')

  if (!groupId || !code) {
    failure.value = 'invalid'
    return
  }

  await auth.init()

  if (!auth.isSignedIn) {
    await router.replace({ name: 'login', query: { next: route.fullPath } })
    return
  }

  if (!auth.hasProfile) {
    await router.replace({ name: 'onboarding', query: { next: route.fullPath } })
    return
  }

  const profile = auth.profile!
  const result = await joinGroup(groupId, code, profile.uid, {
    nickname: profile.nickname,
    payment: profile.payment,
  })

  if (result === 'joined' || result === 'already-member') {
    toast.success(t(result === 'joined' ? 'invite.joinedGroup' : 'invite.alreadyMember'))
    // `claim` lets the group page ask whether a virtual member was them.
    await router.replace({ name: 'group', params: { id: groupId }, query: result === 'joined' ? { claim: '1' } : {} })
    return
  }

  failure.value = result === 'not-found' ? 'notFound' : 'invalid'
}

async function join(): Promise<void> {
  failure.value = null
  try {
    await attempt()
  } catch {
    failure.value = 'retry'
  }
}

onMounted(join)
</script>

<template>
  <main class="grid min-h-dvh place-items-center px-6 text-center">
    <div v-if="!failure" role="status" class="flex flex-col items-center gap-3 text-muted">
      <Loader2 class="size-5 animate-spin" />
      <p class="text-sm">{{ t('invite.joining') }}</p>
    </div>

    <div v-else class="w-full max-w-xs">
      <h1 class="text-lg font-semibold">{{ failure === 'retry' ? t('invite.joinFailed') : t(`invite.${failure}`) }}</h1>
      <p v-if="failure !== 'retry'" class="mt-2 text-sm leading-relaxed text-muted">{{ t('invite.askNewLink') }}</p>
      <AppButton v-else class="mt-5" block @click="join">{{ t('common.retry') }}</AppButton>
      <AppButton class="mt-4" block variant="secondary" @click="router.replace('/groups')">
        {{ t('invite.goToGroups') }}
      </AppButton>
    </div>
  </main>
</template>
