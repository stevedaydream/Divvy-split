<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppFooter from '@/components/layout/AppFooter.vue'
import TopBar from '@/components/layout/TopBar.vue'
import { APP_AUTHOR, REPO_URL } from '@/lib/appInfo'

/**
 * Privacy policy. Every statement here must match what the code and
 * firestore.rules actually do — update this page together with them.
 */
const { locale } = useI18n()

const EFFECTIVE = '2026-09-22'
const ISSUES = `${REPO_URL}/issues`

interface Section {
  title: string
  body?: string[]
  items?: string[]
}

const zh: { title: string; intro: string; sections: Section[] } = {
  title: '隱私權政策',
  intro: `Divvy 是由 ${APP_AUTHOR} 個人開發的分帳與旅行規劃工具。這份政策說明 Divvy 會處理哪些資料、存在哪裡、誰看得到。生效日期：${EFFECTIVE}。`,
  sections: [
    {
      title: '我們處理哪些資料',
      items: [
        'Google 登入：你的 Google 帳號 ID、顯示名稱與 email，用來登入與建立個人檔案。',
        '個人檔案：暱稱、所屬國家、主要幣別，以及你選填的收款資訊（銀行名稱、帳號、LINE ID）。',
        '群組資料：群組名稱、目的地、旅行日期、成員，以及帳目、行程、共同待辦等你和成員輸入的內容。',
        '行李清單：你自己的行李清單項目。',
      ],
    },
    {
      title: '誰看得到你的資料',
      items: [
        '個人檔案（含 email）：只有你自己。',
        '暱稱與收款資訊：你所在群組的成員，方便他們還款給你。',
        '群組的帳目、行程與共同待辦：該群組的所有成員。',
        '行李清單：只有你自己。',
        '邀請：寄件人與收件人看得到邀請內容（群組名稱與寄件人暱稱）。',
      ],
    },
    {
      title: '只存在你裝置上的資料',
      body: ['以下資料只存在你目前使用的瀏覽器或手機，不會上傳到 Divvy：'],
      items: [
        'Gemini API Key，以及額度用盡後的恢復時間。',
        '入境 QR Code 截圖（例如 Visit Japan Web）。',
        '語言、外觀、換算器與圖表的偏好設定，以及暫存的匯率。',
      ],
    },
    {
      title: '第三方服務',
      items: [
        'Google Firebase：登入（Firebase Authentication）、資料庫（Cloud Firestore）、網站代管（Firebase Hosting），資料存放在 Google 的伺服器上。',
        'Firebase App Check 與 reCAPTCHA Enterprise：用來防止濫用 AI 功能，Google 會蒐集裝置與互動訊號判斷是否為真人。',
        'Google Gemini：只在你使用 AI 導遊或 AI 整理清單時，才會把旅行資訊、目前的行程、你貼上的文字或上傳的截圖送給 Google 處理。使用你自己的 API Key 時適用 Gemini API 條款；免費方案的內容可能被 Google 用來改善服務。你的額度用盡時，該次請求會改由 Divvy 的 Firebase AI Logic 處理。',
        'Open Exchange Rates：下載匯率，不含任何個人資料。',
        'BigDataCloud：只有在你按下定位按鈕時，會把裝置的座標送出，換算成國家與城市。',
        'LINE 與 Google 地圖：點擊相關連結時會開啟它們的網站或 app，並適用它們各自的隱私權政策。',
      ],
    },
    {
      title: '我們不做的事',
      items: ['不放廣告。', '不販售或出租你的資料。', '不使用 Google Analytics 或其他追蹤、分析工具。'],
    },
    {
      title: '保存與刪除',
      body: [
        '資料會保存到你刪除為止。你可以隨時刪除自己記的帳目、行程項目與清單，也可以退出群組；群組建立者可以刪除整個群組，連同其中的帳目、行程與待辦。',
        '清除瀏覽器的網站資料，就會刪除只存在裝置上的資料。',
        `如果要刪除整個帳號與個人檔案，請到 GitHub 開一個 issue 提出（請不要在 issue 裡貼出 email 或其他個人資料），我們會在 issue 中說明後續的確認方式。`,
      ],
    },
    {
      title: '政策變更',
      body: ['政策內容有變更時，會更新本頁與上方的生效日期。'],
    },
  ],
}

const en: typeof zh = {
  title: 'Privacy policy',
  intro: `Divvy is an expense-splitting and trip-planning tool built by ${APP_AUTHOR}. This policy explains what data Divvy handles, where it is kept and who can see it. Effective ${EFFECTIVE}.`,
  sections: [
    {
      title: 'What we handle',
      items: [
        'Google sign-in: your Google account ID, display name and email, to sign you in and create your profile.',
        'Profile: nickname, home country, home currency and, if you add them, payment details (bank name, account number, LINE ID).',
        'Group data: group name, destination, trip dates, members, and the expenses, itinerary and shared to-dos you and other members enter.',
        'Packing list: your own packing items.',
      ],
    },
    {
      title: 'Who can see it',
      items: [
        'Your profile (including email): only you.',
        'Nickname and payment details: members of groups you are in, so they can pay you back.',
        "A group's expenses, itinerary and shared to-dos: everyone in that group.",
        'Your packing list: only you.',
        'Invitations: the sender and the recipient (group name and sender nickname).',
      ],
    },
    {
      title: 'Kept only on your device',
      body: ['These stay in the browser or phone you are using and are never uploaded to Divvy:'],
      items: [
        'Your Gemini API key and, after it runs out, when its quota resets.',
        'Arrival QR code screenshots (e.g. Visit Japan Web).',
        'Language, appearance, converter and chart preferences, and cached exchange rates.',
      ],
    },
    {
      title: 'Third-party services',
      items: [
        "Google Firebase: sign-in (Firebase Authentication), database (Cloud Firestore) and hosting (Firebase Hosting); data is stored on Google's servers.",
        'Firebase App Check with reCAPTCHA Enterprise: protects the AI features from abuse; Google collects device and interaction signals to tell people from bots.',
        "Google Gemini: only when you use the AI guide or AI list import are trip details, the current itinerary, text you paste or screenshots you add sent to Google. With your own API key the Gemini API terms apply, and on the free tier Google may use content to improve its services. If your quota runs out, that one request is handled by Divvy's Firebase AI Logic instead.",
        'Open Exchange Rates: downloads exchange rates; no personal data is sent.',
        "BigDataCloud: only when you tap a locate button, your device's coordinates are sent to look up the country and city.",
        'LINE and Google Maps: links open their sites or apps, which have their own privacy policies.',
      ],
    },
    {
      title: 'What we do not do',
      items: ['No ads.', 'We do not sell or rent your data.', 'No Google Analytics or other tracking or analytics tools.'],
    },
    {
      title: 'Keeping and deleting data',
      body: [
        'Data is kept until you delete it. You can delete your own expenses, plan items and list items at any time, or leave a group; a group\'s creator can delete the whole group with its expenses, plan and to-dos.',
        'Clearing the site data in your browser removes what is kept only on your device.',
        'To delete your whole account and profile, open an issue on GitHub (please do not post your email or other personal details there) and we will explain how to confirm the request.',
      ],
    },
    {
      title: 'Changes',
      body: ['When this policy changes, this page and the effective date above are updated.'],
    },
  ],
}

const content = computed(() => (locale.value.startsWith('zh') ? zh : en))
</script>

<template>
  <div class="mx-auto min-h-dvh w-full max-w-md">
    <TopBar :title="content.title" back />

    <article class="space-y-6 px-5 pb-4 pt-5 text-sm leading-relaxed">
      <p class="text-muted">{{ content.intro }}</p>

      <section v-for="section in content.sections" :key="section.title">
        <h2 class="mb-2 text-base font-semibold">{{ section.title }}</h2>
        <p v-for="(paragraph, i) in section.body" :key="i" class="mb-2 text-muted">{{ paragraph }}</p>
        <ul v-if="section.items" class="list-disc space-y-1.5 pl-5 text-muted marker:text-faint">
          <li v-for="(item, i) in section.items" :key="i">{{ item }}</li>
        </ul>
      </section>

      <section>
        <h2 class="mb-2 text-base font-semibold">{{ locale.startsWith('zh') ? '聯絡我們' : 'Contact' }}</h2>
        <p class="text-muted">
          {{ locale.startsWith('zh') ? '對本政策或你的資料有任何問題，請到' : 'For questions about this policy or your data, open an issue at' }}
          <a :href="ISSUES" target="_blank" rel="noopener" class="font-medium text-accent underline-offset-2 hover:underline">
            GitHub Issues
          </a>{{ locale.startsWith('zh') ? ' 提出。' : '.' }}
        </p>
      </section>
    </article>

    <AppFooter />
  </div>
</template>
