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

const failure = ref<string | null>(null)

function param(key: string): string {
  const value = route.query[key]
  return typeof value === 'string' ? value : ''
}

async function attempt(): Promise<void> {
  const groupId = param('g')
  const code = param('c')

  if (!groupId || !code) {
    failure.value = t('invite.invalid')
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
    toast.success(t('invite.joined', { name: '' }).trim())
    await router.replace({ name: 'group', params: { id: groupId } })
    return
  }

  failure.value = result === 'not-found' ? t('invite.notFound') : t('invite.invalid')
}

onMounted(() => {
  attempt().catch(() => {
    failure.value = t('common.somethingWrong')
  })
})
</script>

<template>
  <main class="grid min-h-dvh place-items-center px-6 text-center">
    <div v-if="!failure" class="flex flex-col items-center gap-3 text-muted">
      <Loader2 class="size-5 animate-spin" />
      <p class="text-sm">{{ t('invite.joining') }}</p>
    </div>

    <div v-else class="w-full max-w-xs">
      <p class="text-sm leading-relaxed text-fg">{{ failure }}</p>
      <AppButton class="mt-6" block variant="secondary" @click="router.replace('/groups')">
        {{ t('groups.title') }}
      </AppButton>
    </div>
  </main>
</template>
