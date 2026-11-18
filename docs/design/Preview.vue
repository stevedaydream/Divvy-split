<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AppShell from '../../src/components/layout/AppShell.vue'
import TopBar from '../../src/components/layout/TopBar.vue'
import AppButton from '../../src/components/ui/AppButton.vue'
import AppInput from '../../src/components/ui/AppInput.vue'
import AppField from '../../src/components/ui/AppField.vue'
import AppSheet from '../../src/components/ui/AppSheet.vue'
import TigerMascot from '../../src/components/ui/TigerMascot.vue'
import EntryRow from '../../src/components/group/EntryRow.vue'
import GroupCard from '../../src/components/group/GroupCard.vue'
import ChecklistCard from '../../src/components/group/ChecklistCard.vue'
import CalculatorView from '../../src/views/CalculatorView.vue'
import type { Group } from '../../src/types/models'
const route = useRoute()
const { locale, t } = useI18n()
const dark = ref(document.documentElement.dataset.theme === 'dark')
const sheet = ref(false)
const name = ref('')
const loading = ref(false)
const checked = ref(false)
const message = ref('')
const group = computed<Group>(() => ({ id:'demo', name: name.value || (locale.value === 'zh-TW' ? '京都・散步小旅行' : 'Kyoto · A little adventure'), currency:'JPY',destination:'JP',location:'京都',startDate:'2026-12-11',endDate:'2026-12-13',ownerId:'demo',memberIds:['demo','friend'],members:{demo:{nickname:'Demo',payment:null},friend:{nickname:'Friend',payment:null}},guests:{},ledgerIds:['demo','friend'],inviteCode:'local-fixture',archived:false,createdAt:null,updatedAt:null }))
function theme() { dark.value = !dark.value; document.documentElement.dataset.theme = dark.value ? 'dark' : 'light' }
async function save() { loading.value = true; await new Promise(resolve => setTimeout(resolve, 500)); loading.value = false; sheet.value = false; message.value = t('common.save') }
</script>
<template>
  <div class="mx-auto flex max-w-md flex-wrap gap-2 p-3 text-xs">
    <strong>本機元件預覽 · 假資料</strong>
    <button class="ui-control rounded-lg border border-border px-2" @click="theme">{{ dark ? '淺色' : '深色' }}</button>
    <button class="ui-control rounded-lg border border-border px-2" @click="locale = locale === 'zh-TW' ? 'en' : 'zh-TW'">中 / EN</button>
  </div>
  <CalculatorView v-if="route.path === '/calculator'" />
  <AppShell v-else nav>
    <TopBar :title="route.path === '/profile' ? t('nav.profile') : t('groups.title')" />
    <section class="trip-welcome mx-5 mt-5"><div><p class="trip-welcome__title">Divvy</p><p class="trip-welcome__copy">{{ t('login.tagline') }}</p></div><TigerMascot pose="map" :size="100" /></section>
    <div class="space-y-6 px-5 py-5">
      <nav class="scope-tabs flex gap-1"><button class="ui-control" aria-pressed="true">{{ t('travel.active') }}</button><button class="ui-control" aria-pressed="false">{{ t('travel.archived') }}</button><button class="ui-control" aria-pressed="false">{{ t('travel.hidden') }}</button></nav>
      <GroupCard :group="group" @open="sheet = true" @options="sheet = true" />
      <EntryRow :entry="{id:'fixture',groupId:'demo',type:'expense',title:'飯店住宿與早餐',payerId:'demo',participantIds:['demo','friend'],amountMinor:1580000,currency:'JPY',rate:1,groupAmountMinor:1580000,method:null,category:'lodging',note:'',date:'2026-12-11',createdAt:null,createdBy:'demo'}" :group="group" currency="JPY" :locale="locale" :can-edit="true" />
      <AppButton block @click="sheet = true">{{ t('groups.create') }}</AppButton>
      <ChecklistCard :hint="t('tools.packingHint')" :title="t('tools.packing')" :items="[{ id:'p',text:locale === 'zh-TW' ? '護照與入境資料' : 'Passport and arrival documents',done:checked,updatedBy:'demo',createdAt:null }]" @toggle="checked = !checked" @add="message = $event" @remove="checked = false" />
      <p role="status" class="text-sm text-positive">{{ message }}</p>
      <div class="flex flex-wrap gap-3"><AppButton variant="secondary" @click="sheet = true">{{ t('common.cancel') }}</AppButton><AppButton variant="danger">{{ t('common.delete') }}</AppButton><AppButton disabled>{{ t('common.save') }}</AppButton></div>
      <AppButton :loading="loading" @click="save">{{ t('common.save') }}</AppButton>
    </div>
    <AppSheet :open="sheet" :title="t('groups.newGroup')" @close="sheet = false"><AppField :label="t('groups.name')" for="preview-name"><AppInput id="preview-name" v-model="name" /></AppField><template #footer><div class="flex gap-3"><AppButton variant="secondary" @click="sheet = false">{{ t('common.cancel') }}</AppButton><AppButton :loading="loading" @click="save">{{ t('common.save') }}</AppButton></div></template></AppSheet>
  </AppShell>
</template>

<style> .calculator-shell.calculator-shell { height: calc(var(--app-viewport-height, 100dvh) - 68px); } </style>
