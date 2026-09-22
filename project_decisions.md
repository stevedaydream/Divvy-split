# 技術決策紀錄

## D1. 金額以最小單位整數儲存

**決定**：所有金額存成 `amountMinor: number`（整數），小數位數查 `currencies.ts`。

**原因**：原本用浮點數存金額並以 `amt / n` 分攤，累加會產生誤差，
結算容差被硬編碼成 `0.01`；而且不論幣別一律 `.toFixed(2)`，
JPY／KRW 這類無小數幣別會顯示成 `12000.00`。
整數運算讓餘額總和恆為 0，不需要容差。

**代價**：讀寫都要經過 `toMinor()` / `toMajor()` 轉換。

---

## D2. `Entry.rate` 存匯率快照

**決定**：記帳時把當下匯率寫進文件，`groupAmountMinor` 由它算出。

**原因**：舊版編輯帳目時會用「現在的匯率」重新換算，
導致改個名字就讓三個月前那筆日幣支出的台幣金額改變。

**代價**：同一筆支出在不同日期記錄會有不同匯率，這是正確行為但需向使用者說明
（`group.rateLocked` 文案）。

---

## D3. 邀請改用 `groupId + inviteCode` 雙因子

**決定**：邀請連結為 `/join?g=<groupId>&c=<inviteCode>`。
非成員無法讀取 group 文件，因此拿不到 `inviteCode`。
加入時客戶端把 code 以 `joinCode` 欄位寫入，由 security rule 比對。

**原因**：舊版連結只帶 `groupId`，任何知道 id 的人都能 `arrayUnion` 把自己加進群組。
舊版產生的 `inviteCode` 欄位完全沒被使用。

**代價**：`joinCode` 會殘留在文件中（僅成員可讀，他們本來就有這個 code）。
若要完全乾淨需要 Cloud Functions，目前刻意不引入以維持免費方案。
群組擁有者可用「重設邀請連結」讓舊連結失效。

---

## D4. `Group.members` 反正規化

**決定**：群組文件內存 `members: Record<uid, { nickname, payment }>`。
個人檔案變更時由 `syncMemberProfile()` 批次寫回所有群組。

**原因**：舊版每次群組快照變動就對每位成員各發一次 `getDoc`（N+1）。

**代價**：暱稱／收款資訊有寫入放大；成員很多時同步成本較高，但讀取遠比寫入頻繁。

---

## D5. 自己實作算式解析器

**決定**：`lib/calc.ts` 自行 tokenize + 依運算子優先順序求值。

**原因**：舊版用 `new Function('return ' + expr)()`，
只靠一個正規表達式白名單把關。即使目前無法被利用，把使用者輸入交給 JS 引擎執行
不是計算機該有的做法。

**代價**：不支援括號與一元負號（原本也不支援）。

---

## D6. 匯率 API Key 仍在前端

**現況**：`VITE_OER_API_KEY` 會被打包進 bundle，等同公開。

**決定**：暫不處理。Open Exchange Rates 免費方案本就低風險，
且引入 Cloud Functions 代理會讓專案脫離免費方案。

**若要修正**：加一個 Firebase Function 代理 `/api/rates`，
把 key 移到 Functions 的環境變數。

---

## D7. 移除拖曳排序（計算機）

**決定**：計算機的幣別卡片不再支援長按拖曳排序。
改為「點一下與基準幣別互換」＋「✕ 移除」。

**原因**：原本的拖曳實作混用 touch/mouse 事件、手動追蹤座標、
在 `elementFromPoint` 上判斷落點，約 150 行且無法用鍵盤操作。

**代價**：要調整順序得移除後重新加入。

---

## D8. 不做舊資料相容層

**決定**：新舊 schema 不相容，直接清空 Firestore 重來（開發階段，無真實使用者資料）。

**原因**：保留相容層會讓 service 層長期背負兩套欄位命名與兩種金額格式。
