<script setup lang="ts">
import { computed } from 'vue'
import { Loader2 } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'primary', size: 'md', type: 'button' },
)

const VARIANTS = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-surface-2 text-fg border border-border hover:border-border-strong',
  ghost: 'text-muted hover:text-fg hover:bg-surface-2',
  danger: 'bg-negative-soft text-negative hover:brightness-95',
} as const

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-5 text-base gap-2',
} as const

const classes = computed(() => [
  'inline-flex items-center justify-center rounded-xl font-medium',
  'transition-colors duration-150 active:scale-[0.98]',
  'disabled:opacity-45 disabled:pointer-events-none',
  VARIANTS[props.variant],
  SIZES[props.size],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <Loader2 v-if="loading" class="size-4 animate-spin" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
