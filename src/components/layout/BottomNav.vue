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
    class="bottom-nav fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
  >
    <div class="mx-auto flex max-w-md">
      <RouterLink
        v-for="tab in TABS"
        :key="tab.to"
        :to="tab.to"
        class="bottom-nav__item flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold text-muted transition-colors"
        active-class="bottom-nav__item--active"
      >
        <component :is="tab.icon" class="size-5" :stroke-width="2.25" />
        {{ t(tab.key) }}
      </RouterLink>
    </div>
  </nav>
</template>
