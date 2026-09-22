# Divvy

跨幣別的群組分帳 PWA。記一筆帳、自動換算、用最少的轉帳次數結清。

## 功能

- **群組分帳** — 建立群組、邀請成員、記錄支出並指定分攤對象
- **多幣別** — 以任何幣別記帳，自動換算成群組幣別；**匯率在記帳當下鎖定**
- **智慧結算** — 計算每人淨額，提出最少轉帳次數的還款方案
- **收款資訊** — 結算時直接顯示對方的銀行帳號
- **匯率計算機** — 內建算式鍵盤與多幣別即時換算
- **即時同步** — 群組列表與帳本皆為 Firestore 快照訂閱
- **PWA** — 可安裝、離線可開啟；深／淺色主題；繁體中文與英文

## 技術棧

Vue 3（`<script setup>` + TypeScript strict）· Vite · Tailwind CSS v4 ·
Pinia · Vue Router · vue-i18n · Firebase（Auth + Firestore）· Vitest

## 開始

```bash
npm install
cp .env.example .env    # 填入你的金鑰
npm run dev             # http://localhost:5173
```

### 環境變數

```ini
VITE_OER_API_KEY=                  # Open Exchange Rates
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

### 指令

```bash
npm run dev         # 開發伺服器
npm run typecheck   # vue-tsc --noEmit
npm run test        # vitest run
npm run build       # typecheck + 打包
npm run preview     # 預覽 dist
```

### 部署

```bash
firebase deploy --only firestore:rules,firestore:indexes   # 首次部署務必執行
firebase deploy --only hosting
```

推送到 `main` 時 GitHub Actions 會自動部署 hosting。
**Firestore 規則與索引不在 CI 流程中，需另外手動部署。**

## 文件

| 檔案 | 內容 |
|---|---|
| [project.md](project.md) | 架構總覽、目錄結構、路由、資料模型 |
| [project_conventions.md](project_conventions.md) | 分層規則、命名、樣式與互動慣例 |
| [project_decisions.md](project_decisions.md) | 技術決策與取捨 |
| [project_api.md](project_api.md) | Firestore schema、外部 API、環境變數 |
| [project_bugfix.md](project_bugfix.md) | 踩坑紀錄 |

## 授權

MIT
