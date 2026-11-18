# Divvy 元件風格設計規格

## Overview

版本：2026-11-19。狀態：外觀已套用至本機程式；尚未部署。

依據：使用者提供的 Screenshot_20261119_000406.jpg、project.md、src/styles/main.css、src/router/index.ts、src/views、src/components 與 dev.bat；另納入使用者提供的「小虎｜角色設定」圖（../image/exec-8c03d9e7-b8f1-4605-8251-047d9d8c544a.png）。第一張參考圖的推薦商品、兔子角色與功能文案不作為產品需求；第二張圖的小虎則依使用者要求納入角色視覺。

**Creative North Star:「旅行手帳裡的布貼元件」**

把 Divvy 的旅行與分帳工具轉譯成奶油紙張、粉彩布貼、深灰粗描邊與實心偏移陰影。主操作有縫線與可按壓的厚度；金額、日期、帳本仍維持整齊清楚的工具介面。插畫用在頁首、旅行封面與空狀態，密集資料區讓內容優先。

參考圖是高解析度手機截圖；以下尺寸以 CSS px 規劃，非直接照抄圖片像素。色碼為依圖片觀察制定的近似設計值，非經原始設計檔確認的品牌色。保留 Divvy 現有產品命名、路由與資料規則。

### 現況與目標

| 面向 | 程式現況 | 本規格目標 |
|---|---|---|
| 主色 | 青綠 --c-accent，白字 | 天空藍底、深色字 |
| 背景 | 淺灰與白色 | 奶油紙色與白色卡片 |
| 邊框 | 1px 淺灰 | 主要容器 2–3px 深灰 |
| 陰影 | 柔和模糊 | 無模糊的實心偏移 |
| 圓角 | 按鈕 12、卡片 16、Sheet 24 | 按鈕 16、卡片 24、Sheet 28 |
| 字體 | Inter / system sans | 系統繁中優先，圓潤字體可後續評估 |
| 主題 | 已有明暗切換 | 明亮參考風格 + 另定深色對應 |

本機 CSS 已依此規格套用；main.css 的語意 token 為執行來源。文字連結另用 --c-accent-ink，避免以淺藍按鈕底色直接作為文字色。

## Colors

### 明亮主題建議值

| 現有 token / 新增 token | 建議值 | 用途 |
|---|---|---|
| --c-bg | #FFFCF5 | 奶油紙背景 |
| --c-surface | #FFFFFF | 卡片、輸入、浮層 |
| --c-surface-2 | #F3EDE3 | 次級區塊、未選取項 |
| --c-fg | #3E3A38 | 主文字與實心陰影 |
| --c-muted | #706863 | 次要資訊 |
| --c-faint | #756D66 | 輔助文字，仍需驗證實際底色對比 |
| --c-border-strong | #3E3A38 | 按鈕、卡片外框 |
| --c-border | #D9CFC2 | 內部分隔，不用於唯一操作邊界 |
| --c-accent | #A7D4E5 | 主要操作天空藍 |
| --c-accent-hover | #91C8DD | 主要操作 hover |
| --c-accent-fg | #3E3A38 | 藍底上的文字 |
| --c-accent-soft | #E7F3F8 | 選取、輕提示背景 |
| --c-positive | #356345 | 完成、應收文字 |
| --c-positive-soft（新增） | #B9D99F | 完成徽章、完成型操作 |
| --c-negative | #872C2C | 錯誤、應付、刪除文字 |
| --c-negative-soft | #F6B0A5 | 危險操作粉珊瑚底 |
| --c-warning-soft（新增） | #F5D57D | 待處理、倒數提醒 |
| --c-stitch（新增） | #FFFFFF | 主按鈕內圈裝飾縫線 |
| --c-focus（新增） | #245F78 | 明確的鍵盤焦點 |
| --c-overlay | rgb(62 58 56 / 0.42) | Sheet、Dialog 遮罩 |

**顏色角色規則：** 藍色用於一般主操作；綠色保留完成語意；黃色用於注意；珊瑚色用於錯誤或有後果的操作。帳本的應收／應付沿用文字與正負號說明，不能只靠顏色。

### 深色主題提案

現有 ProfileView 可切換外觀，後續換裝需一併處理。深色版本非參考圖既有內容，屬本文件延伸提案。

| token | 深色值 |
|---|---|
| bg / surface / surface-2 | #242220 / #302D2A / #3A3531 |
| fg / muted / faint | #FFF8EB / #D1C7BA / #BBB1A6 |
| border / border-strong | #776D61 / #D1C7BA |
| accent / accent-hover / accent-fg | #A7D4E5 / #BCE2EF / #242220 |
| accent-soft | #314B55 |
| positive / positive-soft | #B9D99F / #314B37 |
| negative / negative-soft | #F6B0A5 / #553333 |
| warning-soft / stitch / focus | #65522C / #FFFFFF / #BCE2EF |
| overlay | rgb(0 0 0 / 0.65) |

深色實心陰影用 #171513；錯誤按鈕在深色 negative-soft 上用 negative 文字。主按鈕仍保留白縫線，分隔與文字的對比需在實作時逐組驗證。

## Typography

字型建議：`system-ui, -apple-system, 'Segoe UI', 'PingFang TC', 'Microsoft JhengHei', sans-serif`。參考圖的圓潤手寫感優先由形狀與留白建立；若後續加入圓體，先確認繁中、英文與數字字形、授權與載入成本。

| 角色 | 字級 / 行高 / 字重 | 套用 |
|---|---|---|
| 頁面標題 | 26 / 36 / 700 | 揪團、我的、計算機 |
| 區塊標題 | 20 / 28 / 600 | 行李、共同待辦、統計 |
| 卡片標題 | 18 / 26 / 600 | 團名、旅行紀錄 |
| 內文 | 16 / 26 / 400 | 說明、欄位內容 |
| 按鈕 | 16 / 24 / 600 | 主次操作 |
| 次要標籤 | 14 / 20 / 500 | 日期、徽章、幣別 |
| 底部導覽 | 12 / 18 / 500 | 導覽文字 |
| 主金額 | 32–40 / 1.2 / 600 | AmountInput、計算結果 |

金額維持 `.tabular`；幣別與數字不能混淆。輸入字級至少 16px。長英文按鈕可增高換行；團名在列表可截斷，詳情需能讀到全文。數字不加描邊，不用插畫字體。

## Layout

產品介面模式為 Operate：使用者要快速記帳、排行程與找照片。維持 AppShell 目前 max-w-md（Tailwind 預設約 448px）的單欄結構；桌面置中，640px 以上 Sheet 可置中顯示，維持現有流程。

- 間距節奏：4、8、12、16、20、24、32px。
- 頁面左右 20px；320px 窄螢幕可減至 16px。卡片內距 20px，密集列 12–16px。
- 卡片間距 16px；大區塊間距 28–32px，避免把參考圖的大段空白搬進帳本。
- 底部導覽內容高至少 64px，另加 safe-area；內容底部預留導覽、固定工具列與陰影所需高度。
- 表單 footer 在鍵盤開啟時仍能到達；長 Sheet 只捲內容，標題與主要操作保持可見。
- 主要點擊區最小 44×44px；圖示可維持 20–24px，擴大外層命中區。
- 320、390、430、768px 驗證；200% 放大後可閱讀、換行，頁面不可橫向溢出。
- 多張照片可用格狀；照片實體、QR 與圖表不套粉彩濾鏡。

## Elevation & Depth

以結構性實心陰影呈現貼紙厚度，方向全站一致。避免密集清單每列都有大陰影。

| 角色 | 建議 box-shadow | 用途 |
|---|---|---|
| --shadow-card | 3px 5px 0 #3E3A38 | GroupCard、主要功能卡 |
| --shadow-float | 4px 7px 0 #3E3A38 | Dialog、桌面 Sheet |
| --shadow-button（新增） | 2px 4px 0 #3E3A38 | 主要／次要實體按鈕 |
| 輕量列 | none | 帳本列、選擇清單、工具列 |

互動建議：hover 底色略變深；active 向下 2px，陰影縮成 1px 2px 0；120–160ms。以實體位移取代現有 scale(0.98)，減少文字縮放。reduced-motion 下取消位移與旋轉，保留底色回饋。鍵盤 focus 使用 3px focus 色外框、3px offset，不能由縫線代替。

## Shapes

| 元件 | 半徑 | 描邊 |
|---|---|---|
| 主次按鈕 | 16px | 2px border-strong |
| 圖示新增鈕 | 16px | 2px border-strong |
| 主要卡片 | 24px | 3px border-strong |
| 內部子卡、輸入 | 12px | 2px border-strong |
| Sheet / Dialog | 28px | 3px border-strong；手機 Sheet 底部可貼邊 |
| Badge / Chip | 999px | 2px border-strong |
| Checkbox | 6px | 2px border-strong |
| 頭像 | 50% | 2px border-strong |

縫線只用在主操作與少數頁首入口：內縮 4px、2px 白色虛線、圓角隨外框縮小；裝飾層 `pointer-events:none`、`aria-hidden=true`。不得跨過文字；文字四周至少保留 12px。卡片、輸入與每個小圖示不重複加縫線。

## Components

### 1. 按鈕與入口盤點

AppButton 現有 API 保留：variant=primary|secondary|ghost|danger；size=sm|md|lg；block、loading、disabled、type；icon slot。

| 類型 | 來源與現有使用 | 目標外觀 |
|---|---|---|
| Primary | AppButton；登入、建立團、儲存、加入、邀請接受、上傳 | 藍底深字、粗框、白縫線、實心陰影 |
| Secondary | AppButton；取消、選幣別、邀請、備份、匯入 | 白／奶油底深字、粗框、小陰影，無縫線 |
| Ghost | AppButton 與文字操作；收合、稍後、斷開連線 | 透明底深字，hover 淺底；保留完整點擊區 |
| Danger | AppButton、原生刪除／登出 | 珊瑚底深紅字、粗框；實際刪除仍走確認流程 |
| 圖示按鈕 | TopBar、GroupCard、GuestSheet、EntryRow、照片關閉／編輯 | 44px 命中區、20px icon；一般透明底，新增可藍底縫線 |
| 懸浮新增 | GroupsView、GroupDetailView | 藍色厚實圓角按鈕，沿用原有出現條件與位置，避開導覽 |
| 清單操作列 | GroupsView 選單、ProfileView 設定、PackingTemplateSheet | 整列 48px 以上；左圖示右說明，hover 奶油底；無逐列厚陰影 |
| 分頁／篩選 | GroupDetailView 五分頁、GroupsView 三狀態、GroupStats | 未選奶油底、選取淺藍＋深框＋粗字；無縫線與大陰影 |
| 人員／情境選擇 | MemberStrip、EntrySheet、ExpenseItemEditor、ItinerarySheet | 選取用藍底或勾選，同時提供 aria-pressed 或對應語意 |
| 計算機按鍵 | CalculatorView 原生 button | 數字白底細實框，運算子淺藍；等號主藍、清除珊瑚；每鍵至少 48px 高 |
| 選擇器列 | CurrencyPicker、CountryPicker | 搜尋欄與全寬選項；選取勾號；維持原生清單操作 |
| 清單勾選 | ChecklistCard、AI 預覽、範本套用 | 方形粗框，完成綠底深色勾；文字可刪線，完成者仍可讀 |
| 照片批次操作 | PhotoAlbum、PhotoTile | 主上傳藍鈕；保存／下載次按鈕；刪除 danger；選中照片藍框＋勾號 |
| 外部／導覽連結 | AppFooter、Profile、旅行紀錄、AI Key 設定 | 文字連結加底線或明確箭頭，不一律畫成厚按鈕 |

尺寸提案：sm 視覺高 36px、命中區補至 44px；md 高 48px、左右 18px；lg 高 56px、左右 22px。block 填滿可用寬。邊框納入尺寸計算，陰影另留空間。

| 狀態 | 規格 |
|---|---|
| Default | 依角色色、清楚標籤與 icon |
| Hover | 僅支援 hover 的裝置改底色，不隱藏必要操作 |
| Pressed | 位移與短陰影，放開恢復 |
| Focus-visible | 獨立外框，不能被 overflow 裁切 |
| Loading | 保留原文及寬度，以 spinner 取代 icon；禁止重複送出，提供 aria-busy |
| Disabled | 中性紙灰底、弱化陰影、不可操作；必要時附近說明原因 |
| Error | 保留輸入並顯示行內錯誤，允許修正與重試 |

**語意以行為決定。** PackingTemplateSheet、TripRecordsView 有用 ghost 呈現的刪除入口，後續仍應標示危險語意；不能只照現有 variant 名稱重塗顏色。

### 2. 卡片與容器（div / section / article）

不對所有 div 套卡片。AppShell 是版面容器；GroupCard、ChecklistCard、QR 區塊、Profile 設定與統計摘要才是功能表面。密集資料列、按鈕群、排版 wrapper 保持平面。

- GroupCard：白底大圓角粗框與陰影；保留團名、地點、人數、幣別及獨立更多鈕。卡片主要開啟區與更多鈕為兄弟節點，避免巢狀 button。
- TripRecordsView：同一旅行卡片語彙，保留日期、行程與複製入口。封面可後續新增，不能以虛構目的地插畫取代真實資料。
- EntryRow：白底、2px 外框或單一共用列表容器；金額右對齊，編輯／刪除可見。明細展開用淡色分隔，不套第二層大陰影。
- ChecklistCard／GroupTools：標題＋完成數＋輕量操作；只在最外層用厚框。QR 實體維持純白底、原始留白，不加縫線或角標覆蓋。
- GroupStats／ChartCanvas：外層白色功能卡；圖表網格淡色，圖例同時有文字。改 token 時同步檢查 Chart.js 色彩來源。

### 3. 輸入與選擇

AppField 提供可關聯 label 與說明；AppInput、原生 date/select/textarea、清單快速新增、AI Key 輸入共用 12px 圓角、白底、2px 深框與至少 48px 高度。不能只更新 AppInput 而漏掉原生欄位。

focus 保留深框並加外圈；error 用 negative 邊框與文字，設定 aria-invalid、aria-describedby；disabled 顯示紙灰底。placeholder 不替代 label。密碼／Key 保留現有可見性切換行為。

AmountInput：幣別用膠囊選擇鈕，金額維持大字與等寬數字。不在數字外層加縫線，不改動最小貨幣單位、精度或匯率邏輯。

### 4. 導覽與頁首

BottomNav 保留「揪團／計算機／我的」三入口。奶油不透明底、頂部深色線，可在其下加淡虛線；目前選取項用淡藍圓章與深色文字，其他項深灰。不得依參考圖改成四入口。功能圖示沿用 Lucide，以 2–2.25 stroke 統一；小虎用於導覽上方的品牌陪伴與選取圓章，不取代難以辨識的計算機／個人圖示。正式透明角色圖尚待製作，先以 SVG 草圖示意。

TopBar：標題左對齊，返回／設定 44px 點擊區；可用一個小旅行插圖點綴，不遮標題。GroupDetailView 行程／帳本／統計／工具／照片維持原順序與資料狀態，橫向可捲，不擠成無法閱讀的小字。

### 5. Sheet / Dialog / Toast

AppSheet：手機底部展開，白底、深框、大圓角，保留頂部把手、關閉與獨立 footer。AppDialog：相同材質，危險確認使用珊瑚按鈕；取消仍是 secondary。後續需補驗證焦點進入、焦點限制、關閉返回觸發點、標題關聯與 Escape。這些是驗收要求，非宣稱現有程式已完成。

ToastHost：白底粗框小陰影＋狀態 icon／文字，避開底部操作列；成功 role=status、錯誤必要時 role=alert。長工作進度用持續可見區塊，不只瞬間 Toast。

### 6. 其餘共用元件與狀態

- AppAvatar：保留姓名穩定配色與首字，增加一致深框；active 外圈與勾選不能只用色差。
- AppSkeleton：紙灰靜態區塊，保留內容高度；尊重 reduced-motion。
- AppEmptyState：最多一個插畫／icon、一段說明、一個主操作；不要虛構資料。
- AiStatus／AiKeySetup：使用淺藍資訊底，額度限制用黃底並顯示文字；仍保留預覽確認再寫入的現有流程。
- PhotoExpiryNotice：黃底注意卡，顯示期限及保存入口；「已存本機」僅在現有保存流程成功時顯示。
- PhotoTile：影像維持原色，框與選取控制在照片外或安全角落；預覽可用深色舞台。
- 邀請清單：接受 primary、婉拒 secondary，處理中只鎖住對應項目並保留身份資訊。

### 7. 各頁套用範圍

| 畫面 | 應套用的規格 |
|---|---|
| Login / Join | 小插畫、清楚身份／邀請說明、單一主操作、錯誤提示 |
| Onboarding | 表單、國家幣別選擇、定位、儲存 loading |
| Groups | 三狀態篩選、邀請、旅行卡、新增、更多選單、建立表單 |
| GroupDetail | 五分頁、人員列、帳本／行程列、記帳、邀請、三態結算、封存提示 |
| Calculator | 大金額、幣別列、定位、交換、數字／運算鍵、歷史操作 |
| Profile | 個人卡、語言、三種外觀選項、檔案編輯、照片入口、登出 |
| TripRecords | 旅行卡、完整行程、換日期複製、刪除個人副本 |
| Photos | 上傳、全選、篩選、保存／下載、ZIP、Drive、進度、刪除確認 |
| Privacy | 奶油閱讀背景、清楚標題／連結，長文不包厚卡與縫線 |

### 8. 開發交接與 dev.bat

實作順序：main.css 明暗 token → AppButton/Input/Field → Sheet/Dialog → AppShell/TopBar/BottomNav → 業務卡片 → 各 view 與原生按鈕／表單 → 圖表、照片與錯誤狀態。每階段保留原 props、事件、權限與 i18n 文案。新增元件文字同步 zh-TW.ts 與 en.ts。

| dev.bat 選項 | 已讀到的功能 | 後續換裝用途 |
|---|---|---|
| 1 | npm run dev，預設 5173 | 本機預覽 |
| 2 | dev --host | 同網路手機測試 |
| 3 | typecheck + test | 程式驗證 |
| 4 | build + preview，預設 4173 | 檢查建置與 PWA |
| 5 | Firestore 規則／索引部署 | 非純樣式工作的步驟 |
| 6 | build + Hosting 部署 | 僅另外授權發佈時使用 |
| 7 | 規則／索引／Hosting 部署 | 涉及對應後端變更時評估 |

本次以獨立程序啟動本機 dev，覆寫為 demo-divvy 設定；未啟動 dev.bat、未操作正式帳號資料、未部署。dev.bat 明載本機 dev 會連線 .env 指向的正式 Firestore；後續實際互動測試依 AGENTS.md 使用本機 demo 專案與假資料。

### 9. 小虎角色與整體視覺整合

角色來源：[使用者提供的設定圖](../image/exec-8c03d9e7-b8f1-4605-8251-047d9d8c544a.png)。定位為「圓滾滾的旅行夥伴」，在迎接、準備出發與完成旅行時陪伴使用者。沿用設定圖的圓耳、大頭短手腳、奶油口鼻與肚皮、額頭深棕紋、兩頰橫紋、粉色腮紅與條紋彎尾；側面與背面需延續同一身形。

#### 插畫配色與元件關係

以下是依設定圖觀察制定的近似插畫色，並非精確取色：虎黃 #F6C76E、奶油 #FFF6DF、輪廓棕 #594238、腮紅 #F3A395、配件藍 #ACD2DF、草葉綠 #ADC682。插畫棕只用於角色與自然物件；UI 文字、框線與陰影維持既定深灰，形成同一暖色世界。主操作仍是天空藍；虎黃可用於品牌標籤與迎賓點綴，警告必須另有警示 icon 與文字，避免與角色黃色混淆。

| 情境／元件 | 角色版本 | 使用尺度與規則 |
|---|---|---|
| Login / Onboarding | 正面開心、揮手背包 | 120–160px，置於標題前，與表單分開 |
| Groups 頁首 | 戴帽看地圖 | 64–88px，放右側或獨立頁首區，不擠團名 |
| 無進行中旅行 | 揮手背包 | 112–144px，搭配「建立第一個揪團」真實入口 |
| 行程空狀態 / AI 導遊 | 期待、看地圖 | 80–112px，不將期待表情當作 AI 完成狀態 |
| 工具／行李 | 推行李箱 | 64–96px，限區塊標題旁；清單列保持平面 |
| 旅行封存／結清完成 | 開心 | 80–112px，僅在實際成功後顯示 |
| 一般空相簿 | 害羞或正面微笑 | 96px，搭配新增照片；不可表示上傳失敗 |
| 無歷史旅行 | 熟睡 | 96–112px，表示等待下一趟旅行，不表示正在背景工作 |
| 可恢復錯誤 | 委屈 | 64–80px，明確原因及重試優先，角色僅輔助 |
| 照片期限提醒 | 驚訝 | 最多 48px；警示 icon、剩餘天數、保存入口不可省略 |

同一手機視窗至多一幅主角色插畫；帳本、結算明細、QR 與計算鍵盤區不放大型角色。一般按鈕不加入虎頭；功能 icon 與角色插畫分工，避免每次操作都變成插畫展演。

#### 資產與呈現規格

正式製作建議拆成 front / side / back、happy / excited / shy / surprised / sad / sleeping、backpack / map / suitcase 等獨立透明資產。建議目錄為 src/assets/mascot/，採 tiger-map.webp 等語意檔名；目前這些正式資產尚未產生。設定圖含標題、色票與多姿態，不直接當作 App 背景，也不以 CSS 裁切設定圖冒充完整透明角色。

角色外圍保留至少 12% 安全留白，object-fit: contain，不裁耳朵與尾巴；深色主題保留原色與奶油底章，不用反相濾鏡。裝飾圖 alt 為空，狀態內容由可讀文字表達；有獨立意義的角色圖片提供簡短替代文字。預設靜態，後續動效限短暫揮手或點頭，reduced-motion 保持靜態。

#### 配套 SVG 草圖

[整體介面草圖](docs/design/tiger-ui-sketch.svg)：包含揪團首頁、旅行工具、完成狀態與元件板。草圖用簡化 SVG 小虎與虛構旅行資料呈現佈局，非正式角色完稿，也不表示功能已實作；正式素材需以本設定圖對齊角色比例與細節。

### 10. 本機實作交付

- 小虎實作為可縮放 SVG：tiger-welcome.svg 與 tiger-map.svg，包含圓耳、短手腳、條紋、腮紅、奶油肚皮與看地圖的帽子配件；屬依設定稿重新繪製的向量版本。其他表情與旅行姿態仍為未來資產規格，未宣稱已完成全套。
- 共用按鈕、原生控制項、卡片、表單、導覽、明暗主題、圖表配色、網站與 PWA 圖示已更新。Nunito 用於拉丁文字，繁中以系統字型回退。
- 計算機改為結果區獨立捲動，避免固定鍵盤遮擋幣別；手機帳本將金額與編輯操作移到第二列。
- Sheet / Dialog 加入鍵盤焦點管理、Escape、標題關聯與關閉返回焦點。
- 開發中可開啟 `/docs/design/preview.html`：使用真正共用元件與假資料，匯率固定、不登入、不寫 Firestore；此頁不列入正式 Vite 建置入口。
- 色彩對比調整：一般淺色錯誤文字採更深紅；所有對比以 main.css 實值為準。照片、QR 內容維持原色。

## Do's and Don'ts

### Do

- 以粗描邊、柔和彩色面、實心偏移陰影形成一致材質。
- 主操作才使用白縫線；資訊卡、密集帳本與數字區維持清楚。
- 同時檢查共用元件與原生 button、input、select、textarea、RouterLink。
- 保留封存唯讀規則；照片可補傳、個人行李清單與共同待辦的既有權限分開判斷。
- 在實作後檢查文字對比：一般文字至少 4.5:1，大字至少 3:1；控制邊界／焦點至少 3:1。白縫線只作裝飾。
- 用鍵盤、觸控、明暗模式、中英文、長名稱與大金額驗收；核對 typecheck、test、build，並實際操作手機版。

### Don't

- 不搬入第一張參考圖的兔子角色、推薦服務、四格導覽與商品文案；角色統一使用本次指定的小虎。
- 不把截圖像素當作 CSS 尺寸，不讓大圓角與陰影遮擋內容或點擊區。
- 不以全域 div 或 button 選擇器一口氣加厚框，避免破壞清單、圖表與排版 wrapper。
- 不將所有按鈕都變成縫線布貼，也不靠 hover 才露出編輯／刪除。
- 不用新外觀改變結算狀態、刪除範圍、備份狀態、儲存成功與權限判斷。

完成標準：上述現有元件類別皆有一致樣式；按鈕各狀態與表單錯誤可辨識；320px 無橫向溢出；底部內容未被遮住；QR 可掃描、照片不被裝飾遮蓋；實際明暗對比及手機操作完成驗證。這些是未來 UI 實作的驗收項目，本機元件已驗證；正式登入、多人資料與 Google Drive 授權流程仍需於既有環境驗收。
