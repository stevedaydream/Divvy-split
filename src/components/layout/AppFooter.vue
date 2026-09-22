<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { APP_AUTHOR, APP_COMMIT, APP_VERSION, bugReportUrl } from '@/lib/appInfo'

const { t } = useI18n()
const route = useRoute()
const year = new Date().getFullYear()

// Route path only (not the query), so invite codes never land in a public issue.
const reportUrl = computed(() => bugReportUrl(route.path, navigator.userAgent))
</script>

<template>
  <footer class="px-6 py-6 text-center text-[11px] leading-relaxed text-faint">
    <nav class="flex items-center justify-center gap-3">
      <RouterLink :to="{ name: 'privacy' }" class="transition-colors hover:text-fg">
        {{ t('footer.privacy') }}
      </RouterLink>
      <span aria-hidden="true">·</span>
      <a :href="reportUrl" target="_blank" rel="noopener" class="transition-colors hover:text-fg">
        {{ t('footer.reportBug') }}
      </a>
    </nav>
    <p class="mt-1.5">© {{ year }} {{ APP_AUTHOR }}. {{ t('footer.rights') }}</p>
    <p class="tabular">v{{ APP_VERSION }} ({{ APP_COMMIT }})</p>
  </footer>
</template>
