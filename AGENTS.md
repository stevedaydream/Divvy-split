# Divvy — 群組分帳與旅行記帳 PWA

## 技術棧
- Vue 3、TypeScript strict、Pinia、Vite、Tailwind CSS v4、Firebase Auth／Firestore。
- 支援繁體中文與英文；新增介面文案須同步兩份語系檔。

## 常用指令與驗證方式
- `npm run dev`：啟動本機介面。
- `npm run typecheck`、`npm run test`、`npm run build`：程式變更完成後執行。
- `npm run test:emulators`：Firestore 規則或資料交易變更時執行；需 Firebase CLI 與 Java 21。
- UI 變更須用瀏覽器實際操作並檢查手機寬度；模擬測試只用本機 demo 專案。

## 架構與禁忌
- 開始工作先讀 `project.md`；分層為 view → composable／store → service → Firestore。
- view 不得直接 import `firebase/firestore`。
- 金額使用最小單位整數；個人統計與結算共用 `expenseShares`。
- 帳目與行程修改須透過 service 交易更新群組版本；封存群組禁止修改共享內容。
- 群組隱藏不移除成員，避免改變歷史分帳；行李範本與旅行副本只允許本人存取。
- 不能只部署前端而漏掉相配的 Firestore 規則；明細上限與規則需同步（B8）。

## Git 設定
- remote：`origin` → `https://github.com/stevedaydream/Divvy-split.git`（公開）。
- 預設分支：`main`；新功能用 `feature/<名稱>`，經使用者同意才合併。
- 僅在使用者要求時推送；推送 `main` 會觸發 Hosting 自動部署。

## 敏感資訊
- 環境變數與部署資訊見 `secret.md`；該檔與 `.env` 不進 git。
