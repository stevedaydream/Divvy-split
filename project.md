# Divvy — 專案藍圖

跨幣別的群組分帳 PWA。Vue 3 + TypeScript + Vite + Firebase。

---

## 1. 現況

| 項目 | 內容 |
|---|---|
| 框架 | Vue 3.5（`<script setup>` + TypeScript strict） |
| 建置 | Vite（rolldown）+ Tailwind CSS v4 + vite-plugin-pwa |
| 後端 | Firebase Auth（Google）+ Firestore |
| 狀態 | Pinia（auth / groups / rates 三個 store） |
| 語系 | vue-i18n，繁體中文 + 英文 |
| 測試 | Vitest（分帳演算法、算式解析器） |
| 部署 | Firebase Hosting（push 到 `main` 由 GitHub Actions 自動部署；規則／索引仍用 `dev.bat`）→ https://divvy-app-e4565.web.app；`authDomain` 也用 `web.app`（與網站同網域） |

## 2. 目錄結構

```
src/
├── types/        models.ts（UserProfile / Group / Entry / ItineraryItem / Invitation / ChecklistItem）· currency.ts
├── lib/          firebase · money · settlement · stats · itinerary · dates · calc · geo · line
│                 ai（提示詞＋回應驗證）· gemini（API 呼叫＋裝置端 Key＋額度重置時間）· aiFallback · entryQr · random
├── data/         currencies · countries · categories
├── services/     users · groups · entries · itinerary · invitations · checklists   ← 唯一碰 Firestore 的一層
│                 contacts（可邀請的人；未來朋友系統的接口）
├── stores/       auth · groups · rates
├── composables/  useGroupDetail · useInvite · useAiAsk（Key／額度／備援）· useToast · useConfirm · useTheme
├── components/
│   ├── ui/       AppButton · AppSheet · AppDialog · AppInput · AppField
│   │             AppAvatar · AppSkeleton · AppEmptyState · ToastHost
│   ├── layout/   AppShell · TopBar · BottomNav
│   ├── ai/       AiKeySetup · AiStatus（兩個 AI 畫面共用）
│   ├── charts/   ChartCanvas（Chart.js，lazy load）
│   ├── currency/ CurrencyPicker · CountryPicker · AmountInput
│   └── group/    GroupCard · EntryRow · MemberStrip · EntrySheet · SettlementSheet
│                 GroupItinerary · ItinerarySheet · GroupStats · GroupTools · ChecklistCard
│                 InviteSheet · InvitationList · AiGuideSheet · ChecklistImportSheet
├── views/        Login · Join · Onboarding · Groups · GroupDetail · Calculator · Profile
├── i18n/         index.ts · en.ts · zh-TW.ts
├── router/       index.ts
└── styles/       main.css（語意化色彩 token + 深淺色主題）
```

**分層規則**：view → composable/store → service → Firestore。
view 不得直接 import `firebase/firestore`。

## 3. 頁面與路由

| 路徑 | 畫面 | 說明 |
|---|---|---|
| `/` | LoginView | Google 登入，`?next=` 保留原本要去的頁 |
| `/join?g=&c=` | JoinView | 邀請連結入口，驗證 inviteCode 後加入群組 |
| `/onboarding` | OnboardingView | 暱稱、主要幣別、收款資訊 |
| `/groups` | GroupsView | 群組列表（底部導航第 1 格） |
| `/groups/:id` | GroupDetailView | 分頁：行程／帳本（依日期分段）／統計／工具，預設分頁依旅行階段（`defaultTab`）；一人群組隱藏結算與成員列 |
| `/calculator` | CalculatorView | 匯率換算計算機（第 2 格）；定位鈕把基準換成所在地幣別，主要幣別固定排第一 |
| `/profile` | ProfileView | 個人檔案、語言、外觀、登出（第 3 格） |

路由守衛只 `await authStore.init()`（整個 app 生命週期只解析一次），
不再於每次導航重新訂閱 `onAuthStateChanged` 或重讀 profile 文件。

## 4. 資料模型

四個 collection：`users` / `groups` / `entries` / `invitations`，加上子集合 `groups/{id}/itinerary`。

- **金額一律為「最小單位整數」**（`amountMinor`），不使用浮點數累加。
  小數位數由 `data/currencies.ts` 決定（JPY/KRW 為 0，KWD 為 3）。
- **`Entry.rate` 是寫入當下的匯率快照**，`groupAmountMinor` 由它換算而來。
  編輯舊帳目時若金額與幣別未變動，沿用原 rate，金額不會隨時間漂移。
- **`Group.members` 反正規化**存成 `Record<uid, { nickname, payment }>`，
  成員清單不需要 N 次 `getDoc`。`memberIds` 陣列供 `array-contains` 查詢。
- `expense` 與 `settlement` 共用同一個 `Entry` 模型，用 `type` 區分。
- `UserProfile.country` 存所屬國家的 ISO 3166-1 alpha-2 代碼（`data/countries.ts`），
  名稱以 `Intl.DisplayNames` 依語系顯示。選國家時由 `currencyForCountry()` 帶入主要幣別。
  GPS 定位（`lib/geo.ts`）只用來猜幣別，不會寫進個人檔案。
- `Group.destination` 存目的地國家代碼，新增群組時由它帶入群組幣別（建立後幣別仍不可改）；
  `Group.location` 是選填的城市／地區文字。顯示一律用 `placeLabel()` 組成「東京 · 日本」。
- **LINE Pay 還款**：`PaymentInfo.lineId`（選填）。LINE 沒有公開的轉帳／預填金額 URL scheme，
  所以按鈕只複製金額並開啟對方的個人頁（`lib/line.ts`）。LINE Pay Money 只收新台幣：
  群組幣別不是 TWD 時，先用即時匯率預覽並確認換算，帳目存成 `currency: 'TWD'`，
  `groupAmountMinor` 固定為換算前的原始欠款，避免整數新台幣的四捨五入留下尾差。
  `Entry.method = 'linepay'` 標記這筆是用 LINE Pay 付的。

- **分類與消費日期**：`Entry.category` 為固定 6 項代碼（`data/categories.ts`，含依標題自動判斷），
  `Entry.note` 只給「其他」用；`Entry.date` 為 `YYYY-MM-DD` 字串（`lib/dates.ts`，不含時區）。
  舊帳目缺欄位時分類視為 `other`、日期取 `createdAt`。查詢仍依 `createdAt`，排序在 client 端做
  （`compareEntries`：日期新→舊，同日依建立時間）。

- **行程**：`Group.startDate/endDate`（選填，`YYYY-MM-DD`）決定行程天數。每個行程項目
  （`ItineraryItem`：景點／交通／住宿）是一份文件，全員可編輯，記錄 `updatedBy`。
  `estimateMinor` 是群組幣別的預估花費，統計分頁以天對照實際（僅「全體」）。
  排版邏輯在 `lib/itinerary.ts`（`layoutDays` 會把旅行日期外的項目另外列出）。
  刪除群組時一併刪除行程；規則允許群組擁有者刪除他人帳目，否則刪群組會失敗。

- **邀請**：群組頁「邀請成員」開啟 InviteSheet：分享連結，或邀請「最近同行者」
  （`services/contacts.ts` 的 `listContacts`，由已可讀的群組成員算出，不額外查詢）。
  邀請存在 `invitations/{groupId}_{toUid}`，帶著 inviteCode；接受時走原本的 joinGroup，
  所以重設邀請碼也會讓未接受的邀請失效。收到的邀請顯示在群組列表最上方。
  `contacts.ts` 是未來朋友系統的接口（`source: 'friend'`），個人檔案頁已放「好友（即將推出）」。

- **旅行工具**（工具分頁）：行李清單是個人的（`users/{uid}/packing`，以 `groupId` 篩選，只有本人可讀）；
  共同待辦是全群組的（`groups/{id}/todos`）。入境 QR（如 Visit Japan Web）只存在裝置 localStorage
  （`lib/entryQr.ts`，縮至 900px PNG），因為是個人證件、且機場常沒網路。刪除群組不會刪到成員的個人行李清單。
  行李清單的「AI 整理」可貼上旅行社／朋友的清單文字或截圖（`lib/images.ts` 縮成 1600px JPEG），
  AI 分成行李與待辦、略過已存在的項目，預覽勾選後才加入。

- **AI 導遊**（行程分頁）：產生行程／調整行程／解析訂位三種模式，使用者自己的 Gemini Key
  （只存在裝置，見 D16）。回應經 `lib/ai.ts` 驗證，預覽勾選後才寫入行程。
  自己的 Key 額度用盡時，由 Firebase AI Logic 備援完成當次請求並提醒恢復時間，之後停用到恢復為止（D18，`lib/aiFallback.ts`）。

詳見 `src/types/models.ts`。

## 5. 分帳演算法

`src/lib/settlement.ts`，純函式、零相依，由 Vitest 覆蓋：

- `splitEvenly(total, n)` — 整數分攤，餘數給排序在前的人，總和恆等於原金額。
- `computeBalances(entries, memberIds)` — 每位成員的淨額，總和恆為 0。
- `computeSettlements(balances)` — 貪婪配對最大債務人與最大債權人，
  產生至多 `成員數 − 1` 筆轉帳。
- `expenseShares(entry, members)` — 單筆支出每人分攤額，結算與統計共用，兩邊數字一致。

`src/lib/stats.ts`（統計分頁用）：`spendItems`（全體或某人的分攤，排除還款）、
`byCategory`、`byDay`（空白日補 0）、`cumulative`。圖表為 `components/charts/ChartCanvas.vue`，
Chart.js 以 dynamic import 載入；`vite.config.ts` 的 manualChunks 刻意不把它併入 vendor。

## 6. 安全性

`firestore.rules`：

- `groups` 僅成員可讀 → 非成員拿不到 `inviteCode`。
- 加入群組需在寫入中附帶 `joinCode`，規則比對 `resource.data.inviteCode`，
  且只允許把自己加進 `memberIds`，其餘欄位不得變動。
- 群組擁有者可 `rotateInviteCode()` 使舊連結全部失效。
- `entries` 只有 `createdBy` 本人可改／刪，且不可搬移到其他群組。

## 7. 開發指令

```bash
npm run dev         # 開發伺服器
npm run typecheck   # vue-tsc --noEmit
npm run test        # vitest run
npm run build       # typecheck + vite build
npm run preview     # 預覽 dist
```

`dev.bat`（雙擊）：上述指令 + 部署（Firestore 規則／索引、Hosting），
部署一律帶 `--project divvy-app-e4565` 並需輸入 `y` 確認。
