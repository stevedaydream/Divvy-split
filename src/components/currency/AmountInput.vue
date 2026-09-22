<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { decimalsOf } from '@/lib/money'
import type { CurrencyCode } from '@/types/currency'

const props = defineProps<{ modelValue: string; currency: CurrencyCode }>()
const emit = defineEmits<{
  'update:modelValue': [value: string]
  'pick-currency': []
}>()

const decimals = computed(() => decimalsOf(props.currency))
const placeholder = computed(() => (decimals.value === 0 ? '0' : `0.${'0'.repeat(decimals.value)}`))

/**
 * Keeps the field to a valid decimal for the chosen currency — JPY and KRW
 * take no fraction at all, which the old single `.toFixed(2)` ignored.
 */
function onInput(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  const pattern = decimals.value === 0 ? /[^0-9]/g : /[^0-9.]/g
  let cleaned = raw.replace(pattern, '')

  const parts = cleaned.split('.')
  if (parts.length > 2) cleaned = `${parts[0]}.${parts.slice(1).join('')}`

  const [whole = '', fraction] = cleaned.split('.')
  if (fraction !== undefined) cleaned = `${whole}.${fraction.slice(0, decimals.value)}`

  emit('update:modelValue', cleaned)
}
</script>

<template>
  <div class="flex items-center justify-center gap-3 border-b border-border py-3">
    <button
      class="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
      @click="emit('pick-currency')"
    >
      {{ currency }}
      <ChevronDown class="size-3.5" />
    </button>

    <input
      :value="modelValue"
      type="text"
      inputmode="decimal"
      :placeholder="placeholder"
      class="tabular w-40 bg-transparent text-center text-4xl font-light tracking-tight text-fg placeholder:text-faint/50 focus:outline-none"
      @input="onInput"
    />
  </div>
</template>
