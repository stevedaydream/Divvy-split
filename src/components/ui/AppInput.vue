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
    class="paper-input h-12 w-full rounded-xl border border-border bg-surface px-3.5 text-base text-fg transition-colors placeholder:text-faint focus:border-border-strong"
    :class="mono ? 'font-mono tabular' : ''"
    @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
  />
</template>
