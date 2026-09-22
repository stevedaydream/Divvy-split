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
├── types/        models.ts（UserProfile / Group / Entry / Transfer）· currency.ts
├── lib/          firebase · money · settlement · calc · geo · random
├── data/         currencies.ts（唯一的幣別清單，含小數位數與國別對應）
├── services/     users · groups · entries      ← 唯一碰 Firestore 的一層
├── stores/       auth · groups · rates
├── composables/  useGroupDetail · useToast · useConfirm · useTheme
├── components/
│   ├── ui/       AppButton · AppSheet · AppDialog · AppInput · AppField
│   │             AppAvatar · AppSkeleton · AppEmptyState · ToastHost
│   ├── layout/   AppShell · TopBar · BottomNav
│   ├── currency/ CurrencyPicker · AmountInput
│   └── group/    GroupCard · EntryRow · MemberStrip · EntrySheet · SettlementSheet
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
| `/groups/:id` | GroupDetailView | 帳本、成員餘額、結算 |
| `/calculator` | CalculatorView | 匯率換算計算機（第 2 格）；定位鈕把基準換成所在地幣別，主要幣別固定排第一 |
| `/profile` | ProfileView | 個人檔案、語言、外觀、登出（第 3 格） |

路由守衛只 `await authStore.init()`（整個 app 生命週期只解析一次），
不再於每次導航重新訂閱 `onAuthStateChanged` 或重讀 profile 文件。

## 4. 資料模型

三個 collection：`users` / `groups` / `entries`。

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

詳見 `src/types/models.ts`。

## 5. 分帳演算法

`src/lib/settlement.ts`，純函式、零相依，由 Vitest 覆蓋：

- `splitEvenly(total, n)` — 整數分攤，餘數給排序在前的人，總和恆等於原金額。
- `computeBalances(entries, memberIds)` — 每位成員的淨額，總和恆為 0。
- `computeSettlements(balances)` — 貪婪配對最大債務人與最大債權人，
  產生至多 `成員數 − 1` 筆轉帳。

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
