<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import TopBar from '@/components/layout/TopBar.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSheet from '@/components/ui/AppSheet.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSkeleton from '@/components/ui/AppSkeleton.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useConfirm } from '@/composables/useConfirm'
import { createTripFromRecord, deleteTripRecord, watchTripRecords } from '@/services/tripRecords'
import { placeLabel } from '@/data/countries'
import { todayIso } from '@/lib/dates'
import { formatNumber } from '@/lib/money'
import { mapsUrl } from '@/lib/itinerary'
import type { TripRecord } from '@/types/models'

const { t, locale } = useI18n()
const auth = useAuthStore()
const toast = useToast()
const { confirm } = useConfirm()
const router = useRouter()
const records = ref<TripRecord[]>([])
const selected = ref<TripRecord | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const name = ref('')
const start = ref(todayIso())
let stop: (() => void) | null = null
watch(() => auth.uid, (uid) => {
  stop?.(); stop = null; records.value = []; loading.value = true; error.value = ''
  if (!uid) { loading.value = false; return }
  stop = watchTripRecords(uid, (items) => { records.value = items; loading.value = false }, () => { error.value = t('common.somethingWrong'); loading.value = false })
}, { immediate: true })
onScopeDispose(() => stop?.())

function open(record: TripRecord): void { selected.value = record; name.value = record.name; start.value = todayIso(); error.value = '' }
async function copy(): Promise<void> {
  if (saving.value || !selected.value || !auth.profile || !name.value.trim() || !start.value) return
  saving.value = true
  try {
    const id = await createTripFromRecord(selected.value, name.value.trim(), start.value, auth.profile)
    selected.value = null; toast.success(t('groups.created')); await router.push({ name: 'group', params: { id } })
  } catch { error.value = t('travel.copyFailed') }
  finally { saving.value = false }
}
async function remove(): Promise<void> {
  const record = selected.value
  if (!record || !auth.uid || saving.value || !await confirm({ title: t('travel.deleteRecordTitle'), message: t('travel.deleteRecordHint'), confirmLabel: t('common.delete'), tone: 'danger' })) return
  saving.value = true
  try { await deleteTripRecord(auth.uid, record.id); selected.value = null }
  catch { error.value = t('common.somethingWrong') }
  finally { saving.value = false }
}
</script>

<template>
  <AppShell nav>
    <TopBar :title="t('travel.records')" back />
    <div class="space-y-3 px-5 py-5">
      <p class="text-xs leading-relaxed text-muted">{{ t('travel.recordHint') }}</p>
      <p v-if="error && !selected" role="alert" class="text-sm text-negative">{{ error }}</p>
      <AppSkeleton v-if="loading" :rows="3" />
      <p v-else-if="!records.length" class="py-8 text-center text-sm text-muted">{{ t('travel.noRecords') }}</p>
      <button v-for="record in records" :key="record.id" type="button" class="block w-full rounded-card border border-border bg-surface p-4 text-left shadow-card" @click="open(record)">
        <h2 class="text-sm font-semibold">{{ record.name }}</h2>
        <p class="mt-1 text-xs text-muted">{{ placeLabel(record.location, record.destination, locale) }} · {{ record.startDate }}{{ record.endDate ? ` → ${record.endDate}` : '' }}</p>
        <p class="mt-1 text-xs text-faint">{{ t('travel.preview', { count: record.items.length }) }}</p>
      </button>
    </div>
    <AppSheet :open="!!selected" :title="selected?.name" @close="!saving && (selected = null)">
      <template v-if="selected">
        <p class="text-xs text-muted">{{ selected.startDate }}{{ selected.endDate ? ` → ${selected.endDate}` : '' }}</p>
        <ol class="mt-4 space-y-3">
          <li v-for="(item, index) in [...selected.items].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))" :key="index" class="rounded-xl border border-border p-3">
            <p class="tabular text-xs text-muted">{{ item.date }} {{ item.time }}{{ item.endDate ? ` → ${item.endDate}` : '' }} · {{ t(`itinerary.kind.${item.kind}`) }}</p>
            <a :href="mapsUrl(item)" target="_blank" rel="noopener" class="mt-1 block text-sm font-medium text-accent">{{ item.title }}</a>
            <p v-if="item.place" class="mt-1 text-xs text-muted">{{ item.place }}</p>
            <p v-if="item.note" class="mt-1 whitespace-pre-wrap text-xs text-muted">{{ item.note }}</p>
            <p v-if="item.estimateMinor" class="tabular mt-1 text-xs text-muted">{{ t('stats.estimated') }} {{ formatNumber(item.estimateMinor, selected.currency, locale) }} {{ selected.currency }}</p>
          </li>
        </ol>
        <section class="mt-5 space-y-3 border-t border-border pt-4">
          <h3 class="text-sm font-medium">{{ t('travel.copy') }}</h3>
          <label class="block space-y-1 text-xs text-muted"><span>{{ t('groups.name') }}</span><AppInput v-model="name" maxlength="120" /></label>
          <label class="block space-y-1 text-xs text-muted"><span>{{ t('itinerary.startDate') }}</span><input v-model="start" type="date" class="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg" /></label>
          <p class="text-xs leading-relaxed text-muted">{{ t('travel.copyHint') }}</p>
          <AppButton block :loading="saving" :disabled="!name.trim() || !start || selected.items.length > 450" @click="copy">{{ t('travel.copy') }}</AppButton>
          <AppButton variant="ghost" block :disabled="saving" @click="remove">{{ t('travel.deleteRecord') }}</AppButton>
        </section>
        <p v-if="error" role="alert" class="mt-3 text-xs text-negative">{{ error }}</p>
      </template>
    </AppSheet>
  </AppShell>
</template>
