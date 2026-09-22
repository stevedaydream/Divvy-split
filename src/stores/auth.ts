import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { fetchProfile, saveProfile } from '@/services/users'
import { syncMemberProfile } from '@/services/groups'
import type { UserProfile } from '@/types/models'

/**
 * Owns the Firebase auth session and the signed-in user's profile.
 *
 * `ready` resolves once on app start. The router awaits it instead of
 * re-subscribing to `onAuthStateChanged` and re-reading the profile on every
 * navigation, which is what used to make routing feel sluggish.
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<UserProfile | null>(null)
  const initialised = ref(false)

  const isSignedIn = computed(() => user.value !== null)
  const hasProfile = computed(() => profile.value !== null && profile.value.nickname !== '')
  const uid = computed(() => user.value?.uid ?? null)

  let readyPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (readyPromise) return readyPromise

    readyPromise = new Promise<void>((resolve) => {
      onAuthStateChanged(auth, async (nextUser) => {
        user.value = nextUser
        profile.value = nextUser ? await fetchProfile(nextUser.uid) : null
        initialised.value = true
        resolve()
      })
    })

    return readyPromise
  }

  async function signIn(): Promise<void> {
    const credential = await signInWithPopup(auth, googleProvider)
    user.value = credential.user
    profile.value = await fetchProfile(credential.user.uid)
  }

  async function logout(): Promise<void> {
    await signOut(auth)
    user.value = null
    profile.value = null
  }

  async function refreshProfile(): Promise<void> {
    if (!user.value) return
    profile.value = await fetchProfile(user.value.uid)
  }

  /**
   * Persists a profile change and mirrors the group-visible fields into every
   * group the member belongs to, so member lists stay a single read.
   */
  async function updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const current = user.value
    if (!current) return

    await saveProfile(current.uid, { ...patch, email: current.email ?? '' })
    profile.value = await fetchProfile(current.uid)

    const next = profile.value
    if (next) {
      await syncMemberProfile(current.uid, { nickname: next.nickname, payment: next.payment })
    }
  }

  return {
    user, profile, initialised, isSignedIn, hasProfile, uid,
    init, signIn, logout, refreshProfile, updateProfile,
  }
})
