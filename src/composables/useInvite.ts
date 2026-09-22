import { useI18n } from 'vue-i18n'
import { useToast } from '@/composables/useToast'
import type { Group } from '@/types/models'

/**
 * Copies a group's invite link and, where the device supports it, opens the
 * system share sheet so it can go straight to LINE or Messages.
 *
 * Both calls start synchronously inside the click: `navigator.share` needs a
 * fresh user gesture, so it must not wait for the clipboard write first.
 */
export function useInvite() {
  const { t } = useI18n()
  const toast = useToast()

  async function invite(group: Group): Promise<void> {
    const url = `${window.location.origin}/join?g=${group.id}&c=${group.inviteCode}`

    const copied =
      navigator.clipboard?.writeText(url).then(
        () => true,
        () => false,
      ) ?? Promise.resolve(false)

    const shared =
      typeof navigator.share === 'function'
        ? navigator
            .share({ title: group.name, text: t('invite.shareText', { name: group.name }), url })
            .then(
              () => true,
              // AbortError means the user closed the sheet; the link is still copied.
              () => false,
            )
        : Promise.resolve(false)

    const [didCopy, didShare] = await Promise.all([copied, shared])
    if (didCopy) toast.success(t('invite.copied'))
    else if (!didShare) toast.info(t('invite.copyFailed', { url }), 10000)
  }

  return { invite }
}
