<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, Search } from 'lucide-vue-next'
import AppSheet from '@/components/ui/AppSheet.vue'
import { COUNTRY_CODES, POPULAR_COUNTRIES, countryName } from '@/data/countries'

const props = defineProps<{
  open: boolean
  title: string
  selected?: string | null
}>()

const emit = defineEmits<{ close: []; select: [code: string] }>()

const { locale } = useI18n()
const search = ref('')

watch(
  () => props.open,
  (open) => {
    if (open) search.value = ''
  },
)

const countries = computed(() =>
  COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale.value) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale.value),
  ),
)

const results = computed(() => {
  const query = search.value.trim().toLowerCase()
  if (!query) return countries.value
  return countries.value.filter(
    (c) => c.code.toLowerCase() === query || c.name.toLowerCase().includes(query),
  )
})

const popular = computed(() => (search.value ? [] : POPULAR_COUNTRIES))
</script>

<template>
  <AppSheet :open="open" :title="title" @close="emit('close')">
    <div class="sticky -top-5 -mx-5 -mt-5 mb-4 border-b border-border bg-surface px-5 py-3">
      <div class="relative">
        <Search class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <input
          v-model="search"
          type="search"
          :placeholder="$t('country.search')"
          class="h-11 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm focus:border-accent focus:outline-none"
        />
      </div>
    </div>

    <section v-if="popular.length" class="mb-5">
      <h3 class="mb-2 text-xs font-medium text-muted">{{ $t('currency.popular') }}</h3>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="code in popular"
          :key="code"
          class="rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
          :class="
            selected === code
              ? 'border-accent bg-accent-soft text-accent'
              : 'border-border text-muted hover:border-border-strong hover:text-fg'
          "
          @click="emit('select', code)"
        >
          {{ countryName(code, locale) }}
        </button>
      </div>
    </section>

    <ul class="-mx-2">
      <li v-for="item in results" :key="item.code">
        <button
          class="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
          @click="emit('select', item.code)"
        >
          <span class="truncate text-sm font-medium">{{ item.name }}</span>
          <Check v-if="selected === item.code" class="size-4 shrink-0 text-accent" />
        </button>
      </li>
    </ul>

    <p v-if="!results.length" class="py-10 text-center text-sm text-muted">
      {{ $t('country.none_found') }}
    </p>
  </AppSheet>
</template>
