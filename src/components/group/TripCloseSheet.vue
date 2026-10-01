<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSheet from '@/components/ui/AppSheet.vue'
import AppButton from '@/components/ui/AppButton.vue'
import { useToast } from '@/composables/useToast'
import { finishTrip, reopenTrip } from '@/services/tripRecords'
import type { Group, ItineraryItem } from '@/types/models'

const props = defineProps<{ open: boolean; group: Group; uid: string; items: ItineraryItem[]; unsettled: boolean; ready: boolean }>()
const emit = defineEmits<{ close: []; settle: [] }>()
const { t } = useI18n()
const toast = useToast()
const saving = ref(false)
const saveRecord = ref(true)
const error = ref('')
const owner = computed(() => props.group.ownerId === props.uid)
watch(() => props.open, (open) => { if (open) { saveRecord.value = !!props.items.length; error.value = '' } })

async function run(archive: boolean, reopen = false): Promise<void> {
  if (saving.value || !props.ready) return
  saving.value = true
  error.value = ''
  try {
    if (reopen) await reopenTrip(props.group.id)
    else await finishTrip(props.group.id, props.uid, archive ? saveRecord.value : true, archive)
    toast.success(t(reopen ? 'travel.reopened' : archive ? 'travel.finished' : 'travel.saved'))
    emit('close')
  } catch (cause) {
    const code = (cause as Error).message
    error.value = t(code === 'unsettled' ? 'travel.unsettled' : code === 'trip-changed' ? 'travel.changed' : 'common.somethingWrong')
  } finally { saving.value = false }
}
</script>

<template>
  <AppSheet :open="open" :title="t(group.archived ? 'travel.archived' : 'travel.finish')" @close="!saving && emit('close')">
    <p class="text-sm leading-relaxed text-muted">{{ t(group.archived ? 'travel.readonlyHint' : 'travel.finishHint') }}</p>
    <p v-if="!owner && !group.archived" class="mt-3 text-xs text-muted">{{ t('travel.ownerOnly') }}</p>
    <div v-if="unsettled && !group.archived" class="mt-4 rounded-xl border border-negative/30 bg-negative-soft p-3 text-sm text-negative">
      {{ t('travel.unsettled') }}
      <AppButton variant="secondary" size="sm" block class="mt-3" @click="emit('close'); emit('settle')">{{ t('settle.title') }}</AppButton>
    </div>
    <section v-if="items.length" class="mt-5">
      <h3 class="text-sm font-medium">{{ t('travel.preview', { count: items.length }) }}</h3>
      <p class="mt-1 text-xs text-muted">{{ group.startDate }}{{ group.endDate ? ` → ${group.endDate}` : '' }}</p>
      <ul class="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-xl border border-border p-3 text-xs">
        <li v-for="item in [...items].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))" :key="item.id"><span class="tabular text-muted">{{ item.date }} {{ item.time }}</span> · {{ item.title }}</li>
      </ul>
      <label v-if="owner && !group.archived" class="mt-4 flex items-center gap-2 text-sm"><input v-model="saveRecord" type="checkbox" class="accent-accent" />{{ t('travel.saveRecord') }}</label>
      <p class="mt-2 text-xs leading-relaxed text-muted">{{ t('travel.recordHint') }}</p>
    </section>
    <p v-if="error" role="alert" class="mt-4 text-sm text-negative">{{ error }}</p>
    <template #footer>
      <div class="space-y-2">
        <AppButton v-if="items.length" variant="secondary" block :loading="saving" :disabled="!ready" @click="run(false)">{{ t('travel.saveRecord') }}</AppButton>
        <AppButton v-if="owner" block :loading="saving" :disabled="!ready || (!group.archived && unsettled)" @click="group.archived ? run(false, true) : run(true)">{{ t(group.archived ? 'travel.reopen' : 'travel.finish') }}</AppButton>
      </div>
    </template>
  </AppSheet>
</template>
