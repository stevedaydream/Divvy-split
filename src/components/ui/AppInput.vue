<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: string
    type?: string
    placeholder?: string
    id?: string
    inputmode?: 'text' | 'numeric' | 'decimal' | 'email'
    mono?: boolean
    autocomplete?: string
  }>(),
  { type: 'text' },
)
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <input
    :id="id"
    :value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :inputmode="inputmode"
    :autocomplete="autocomplete"
    class="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-sm text-fg transition-colors placeholder:text-faint focus:border-accent focus:outline-none"
    :class="mono ? 'font-mono tabular' : ''"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
