<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ExternalLink, KeyRound } from 'lucide-vue-next'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'

/** Collects the user's Gemini key; it is stored on this device only (D16). */
const emit = defineEmits<{ save: [key: string] }>()
const { t } = useI18n()
const draft = ref('')

function save(): void {
  emit('save', draft.value)
  draft.value = ''
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center gap-2">
      <KeyRound class="size-4 text-accent" />
      <h3 class="text-sm font-semibold">{{ t('ai.keyTitle') }}</h3>
    </div>
    <p class="text-xs leading-relaxed text-muted">{{ t('ai.keyHint') }}</p>
    <a
      href="https://aistudio.google.com/apikey"
      target="_blank"
      rel="noopener"
      class="inline-flex items-center gap-1 text-xs font-medium text-accent"
    >
      {{ t('ai.getKey') }} <ExternalLink class="size-3" />
    </a>
    <AppInput v-model="draft" type="password" autocomplete="off" :placeholder="t('ai.keyPlaceholder')" />
    <AppButton block :disabled="!draft.trim()" @click="save">{{ t('common.save') }}</AppButton>
  </section>
</template>
