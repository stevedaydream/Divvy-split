<script setup lang="ts">
import { Calculator, User, Users } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// A persistent tab bar: the old build reached the calculator through a small
// text link and the profile only through a modal on the dashboard.
const TABS = [
  { to: '/groups', icon: Users, key: 'nav.groups' },
  { to: '/calculator', icon: Calculator, key: 'nav.calculator' },
  { to: '/profile', icon: User, key: 'nav.profile' },
] as const
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto flex max-w-md">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted transition-colors"
        active-class="!text-accent"
      >
        <component :is="tab.icon" class="size-5" :stroke-width="1.75" />
        {{ t(tab.key) }}
      </RouterLink>
    </div>
  </nav>
</template>
