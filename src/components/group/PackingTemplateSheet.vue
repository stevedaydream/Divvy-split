<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSheet from '@/components/ui/AppSheet.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useConfirm } from '@/composables/useConfirm'
import { useToast } from '@/composables/useToast'
import { applyPackingTemplate, deletePackingTemplate, savePackingTemplate, watchPackingTemplates, type PackingTemplate } from '@/services/packingTemplates'
import type { ChecklistItem } from '@/types/models'

const props = defineProps<{ open: boolean; uid: string; groupId: string; items: ChecklistItem[] }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const { confirm } = useConfirm()
const toast = useToast()
const templates = ref<PackingTemplate[]>([])
const selected = ref<PackingTemplate | null>(null)
const name = ref('')
const saving = ref(false)
const loading = ref(true)
const error = ref('')
const picked = ref<string[]>([])
let stop: (() => void) | null = null
watch(() => [props.open, props.uid] as const, ([open, uid]) => {
  stop?.(); stop = null
  if (!open || !uid) return
  selected.value = null; name.value = ''; error.value = ''; loading.value = true
  stop = watchPackingTemplates(uid, (items) => { templates.value = items; loading.value = false }, () => { error.value = t('common.somethingWrong'); loading.value = false })
}, { immediate: true })
onScopeDispose(() => stop?.())
const available = computed(() => {
  const existing = new Set(props.items.map((item) => item.text.trim()))
  return selected.value?.texts.filter((text) => !existing.has(text.trim())) ?? []
})
function select(template: PackingTemplate): void { selected.value = template; picked.value = [...template.texts] }
function toggle(text: string): void { picked.value = picked.value.includes(text) ? picked.value.filter((item) => item !== text) : [...picked.value, text] }

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true; error.value = ''
  try {
    await savePackingTemplate(props.uid, name.value, props.items.map((item) => item.text))
    name.value = ''; toast.success(t('templates.saved'))
  } catch { error.value = t('common.somethingWrong') }
  finally { saving.value = false }
}
async function apply(): Promise<void> {
  if (saving.value) return
  const texts = available.value.filter((text) => picked.value.includes(text))
  if (!texts.length) return
  saving.value = true; error.value = ''
  try {
    const count = await applyPackingTemplate(props.uid, props.groupId, texts)
    selected.value = null; toast.success(t('templates.applied', { count }))
  } catch { error.value = t('common.somethingWrong') }
  finally { saving.value = false }
}
async function remove(template: PackingTemplate): Promise<void> {
  if (saving.value || !await confirm({ title: t('templates.deleteTitle', { name: template.name }), message: t('templates.deleteHint'), confirmLabel: t('common.delete'), tone: 'danger' })) return
  saving.value = true
  try { await deletePackingTemplate(props.uid, template.id); if (selected.value?.id === template.id) selected.value = null }
  catch { error.value = t('common.somethingWrong') }
  finally { saving.value = false }
}
</script>

<template>
  <AppSheet :open="open" :title="t('templates.title')" @close="!saving && emit('close')">
    <p class="text-xs leading-relaxed text-muted">{{ t('templates.hint') }}</p>
    <section v-if="items.length" class="mt-4 rounded-xl border border-border p-3">
      <h3 class="mb-2 text-sm font-medium">{{ t('templates.saveCurrent', { count: items.length }) }}</h3>
      <AppInput v-model="name" maxlength="80" :placeholder="t('templates.namePlaceholder')" :aria-label="t('templates.name')" />
      <AppButton block variant="secondary" class="mt-2" :loading="saving" :disabled="!name.trim() || items.length > 450" @click="save">{{ t('templates.save') }}</AppButton>
    </section>
    <p v-if="loading" class="mt-4 text-xs text-muted">{{ t('common.loading') }}</p>
    <p v-else-if="!templates.length" class="mt-4 text-sm text-muted">{{ t('templates.empty') }}</p>
    <div v-else class="mt-5 space-y-2">
      <article v-for="template in templates" :key="template.id" class="flex items-center gap-2 rounded-xl border border-border p-3">
        <button type="button" class="min-w-0 flex-1 text-left" :disabled="saving" @click="select(template)"><span class="block truncate text-sm font-medium">{{ template.name }}</span><span class="text-xs text-muted">{{ t('templates.count', { count: template.texts.length }) }}</span></button>
        <AppButton variant="ghost" size="sm" :disabled="saving" @click="remove(template)">{{ t('common.delete') }}</AppButton>
      </article>
    </div>
    <section v-if="selected" class="mt-5 rounded-xl border border-accent/40 p-3">
      <h3 class="text-sm font-medium">{{ selected.name }}</h3>
      <p class="mt-1 text-xs text-muted">{{ t('templates.applyHint') }}</p>
      <p v-if="!available.length" class="mt-3 text-xs text-muted">{{ t('templates.noNew') }}</p>
      <div class="mt-3 max-h-64 space-y-2 overflow-y-auto">
        <label v-for="text in available" :key="text" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="picked.includes(text)" class="accent-accent" @change="toggle(text)" />{{ text }}</label>
      </div>
      <AppButton block class="mt-3" :loading="saving" :disabled="!available.some((text) => picked.includes(text))" @click="apply">{{ t('templates.apply') }}</AppButton>
    </section>
    <p v-if="error" role="alert" class="mt-4 text-xs text-negative">{{ error }}</p>
  </AppSheet>
</template>
