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

const classes = computed(() => [
  'app-button', `app-button--${props.variant}`, `app-button--${props.size}`,
  props.block ? 'w-full' : '',
])
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading || undefined" class="ui-control">
    <Loader2 v-if="loading" class="size-4 animate-spin" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>
