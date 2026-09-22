# 踩坑紀錄

> 只記錄修了三次以上才解決的 Bug，或具平台／工具特殊性的問題。

## B1. Tailwind v4 的主題設定不在 `tailwind.config.js`

**現象**：改了 `tailwind.config.js` 的 `theme.extend.colors` 完全沒有作用。

**原因**：Tailwind v4 改用 CSS-first 設定。專案同時存在 `tailwind.config.js`
與 `style.css` 的 `@theme` 區塊，兩者色票內容還不一致，實際生效的是後者。

**處理**：刪除 `tailwind.config.js`，主題一律定義在 `styles/main.css`。

---

## B2. 深色模式的 token 必須用 `@theme inline`

**現象**：把語意色寫進 `@theme { --color-bg: var(--c-bg) }` 後，
切換 `data-theme` 時顏色不會變。

**原因**：`@theme`（非 inline）會把變數的值在建置時求值並固定下來，
`var(--c-bg)` 因此被凍結成 light 模式的值。

**處理**：使用 `@theme inline`，Tailwind 才會把 `var()` 原樣輸出到 utility class，
執行時才解析，`[data-theme='dark']` 覆寫的 `--c-*` 就能生效。

---

## B3. `composite: true` 的 tsconfig 不能設 `noEmit`

**現象**：`vue-tsc --noEmit` 報
`TS6310: Referenced project 'tsconfig.node.json' may not disable emit.`

**原因**：被 `references` 參照的專案必須可 emit（要產出 `.d.ts`），
不能同時宣告 `composite: true` 與 `noEmit: true`。

**處理**：`tsconfig.node.json` 移除 `noEmit`。

---

## B4. Git Bash 的 heredoc 有長度上限

**現象**：用 `cat > file <<'EOF'` 寫入約 90 行以上的內容時，
檔案在中途被截斷，shell 回報
`warning: here-document delimited by end-of-file (wanted 'EOF')`。

**原因**：Windows 上 Git Bash 傳入單一指令字串的長度有限制。

**處理**：分段寫入（`cat >` 後再用 `cat >>` 追加），每段控制在 80 行以內；
追加時注意上一段的括號／大括號是否已經閉合。

---

## B5. `.firebaserc` 的 default 專案與 `.env` 不一致

**現象**：`firebase deploy` 成功，但 Firestore 規則／索引／網站都沒有更新，看起來像後端壞掉。

**原因**：`.firebaserc` 的 `default` 指向 `device-streaming-e921c475`，
但前端 `.env` 連的是 `divvy-app-e4565`，CLI 部署到了錯的專案。

**處理**：`default` 改為 `divvy-app-e4565`；部署前可用 `firebase use` 確認目前專案。
GitHub Actions 兩個 workflow 也同樣指錯，已改 `projectId` 與 secret 名稱（`FIREBASE_SERVICE_ACCOUNT_DIVVY_APP_E4565`）。
