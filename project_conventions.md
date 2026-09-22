# 開發慣例

## 分層

```
view → composable / store → service → Firestore
```

- **view** 不得 import `firebase/*`。需要資料時走 store 或 composable。
- **service** 是唯一呼叫 Firestore API 的地方，並負責把文件轉成 `types/models.ts` 的型別
  （每個 service 都有一個 `toXxx()` 轉換函式，補齊缺漏欄位的預設值）。
- **lib** 放純函式：不可 import Vue、Pinia、Firestore。因此可直接單元測試。

## 命名

| 對象 | 規則 | 範例 |
|---|---|---|
| 頁面元件 | `XxxView.vue` | `GroupDetailView.vue` |
| 通用 UI 元件 | `AppXxx.vue` | `AppButton.vue` |
| 領域元件 | 直接命名 | `EntryRow.vue` |
| Composable | `useXxx.ts` | `useGroupDetail.ts` |
| Store | `stores/<name>.ts`，`useXxxStore` | `useAuthStore` |
| 最小單位金額 | 一律以 `Minor` 結尾 | `amountMinor` |

## 金額

- 儲存與計算一律用**最小單位整數**。
- 顯示一律經過 `lib/money.ts` 的 `formatMoney()` 或 `formatNumber()`，
  它會查 `currencies.ts` 取得正確小數位數。
- **禁止**在元件裡寫 `.toFixed(2)`。
- 顯示金額的元素加上 `.tabular` class，數字才會等寬對齊。

## 樣式

- 只使用 `styles/main.css` 定義的語意 token：
  `bg` `surface` `surface-2` `border` `border-strong` `fg` `muted` `faint`
  `accent` `accent-hover` `accent-fg` `accent-soft` `positive` `negative` `negative-soft`
- **禁止**在元件中寫死 hex 或使用 Tailwind 的數字色階（`zinc-500`、`teal-600`…）。
  要新增顏色就往 `:root` 與 `[data-theme='dark']` 各加一組。
- 深色模式由 `data-theme` 屬性驅動（`index.html` 在首次繪製前就設好，避免閃爍）。

## 互動

- **禁用** `alert()` / `confirm()`。改用 `useToast()` 與 `useConfirm()`。
- 彈出層一律用 `AppSheet`（底部彈出，手機拇指可及）；
  只有破壞性確認用 `AppDialog`。
- **禁止**把唯一的操作入口藏在 `hover` 或長按之後 —— 手機沒有 hover。
  長按只能作為既有明確按鈕的加速捷徑。

## 訂閱

任何 `onSnapshot` 都必須能被取消：service 回傳 unsubscribe，
composable 以 `onScopeDispose()` 收掉。元件內不得直接呼叫 `onSnapshot`。

## i18n

- 所有使用者可見文字都走 `$t()` / `t()`，不得硬編碼。
- 新增 key 必須同時補 `en.ts` 與 `zh-TW.ts`，兩檔結構保持一致。

## TypeScript

- `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals` 全開。
- 索引存取後要處理 `undefined`（用 `??` 或 `!`，不要關掉設定）。
- 匯入型別用 `import type`（`verbatimModuleSyntax` 已啟用）。

## 提交前

```bash
npm run typecheck && npm run test && npm run build
```
