# API 與資料結構

## Firestore

### `users/{uid}`

```ts
{
  nickname: string
  email: string
  currency: string          // 主要幣別，如 'TWD'
  nationality: string       // 'Taipei, Taiwan'
  payment: { bankName: string; bankAccount: string } | null
  createdAt: Timestamp      // 只在文件建立時寫入
  updatedAt: Timestamp
}
```

讀：任何已登入使用者（群組成員需看到彼此的收款資訊）
寫：只有本人

### `groups/{groupId}`

```ts
{
  name: string
  currency: string          // 建立後不可變更
  location: string
  ownerId: string
  memberIds: string[]                                   // 供 array-contains 查詢
  members: Record<uid, { nickname, payment }>           // 反正規化
  inviteCode: string                                    // 祕密，僅成員可讀
  joinCode?: string                                     // 加入時的驗證欄位（見 D3）
  archived: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

讀：僅 `memberIds` 內的成員
建立：`ownerId` 必須是自己，`memberIds` 必須恰為 `[自己]`，`inviteCode` 至少 8 字元
更新：成員編輯 / 持邀請碼加入 / 自行退出，三者擇一（非擁有者不可改 inviteCode）
刪除：僅擁有者

### `entries/{entryId}`

```ts
{
  groupId: string
  type: 'expense' | 'settlement'
  title: string
  payerId: string
  participantIds: string[]  // settlement 時長度為 1，即收款人
  amountMinor: number       // 原幣最小單位整數
  currency: string
  rate: number              // 寫入當下的匯率快照
  groupAmountMinor: number  // 換算成群組幣別的最小單位
  createdAt: Timestamp
  createdBy: string
}
```

讀：該群組成員
建立：必須是群組成員，且 `createdBy === payerId === 自己`
更新／刪除：僅 `createdBy` 本人，且不可搬移 `groupId`

### 索引

`entries`：`groupId ASC` + `createdAt DESC`（定義於 `firestore.indexes.json`）

---

## 外部 API

### Open Exchange Rates

```
GET https://openexchangerates.org/api/latest.json?app_id=<VITE_OER_API_KEY>
→ { base: 'USD', rates: { TWD: 31.2, JPY: 149.5, ... } }
```

- 所有匯率以 USD 為基準；`rateFrom(rates, from, to) = rates[to] / rates[from]`。
- `stores/rates.ts` 以 localStorage 快取 1 小時（key：`divvy:rates`）。
- 取得失敗時保留舊資料，UI 顯示 `currency.stale` 提示。

### BigDataCloud 反向地理編碼（免金鑰）

```
GET https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=&longitude=&localityLanguage=en
→ { city, locality, principalSubdivision, countryName, countryCode }
```

`lib/geo.ts` 的 `detectLocation()` 取得 `"City, Country"` 與 `countryCode`，
後者再經 `currencyForCountry()` 推測幣別。使用者拒絕授權時直接 reject，呼叫端顯示提示。

---

## localStorage keys

| Key | 內容 |
|---|---|
| `divvy:theme` | `'light' \| 'dark'`，未設定表示跟隨系統 |
| `divvy:locale` | `'en' \| 'zh-TW'` |
| `divvy:rates` | `{ rates, fetchedAt }` 匯率快取 |
| `divvy:calc-base` | 計算機基準幣別 |
| `divvy:calc-targets` | 計算機目標幣別清單 |
| `divvy:calc-history` | 計算紀錄（最多 40 筆） |

所有讀寫都包在 try/catch 中：無痕模式或封鎖 site data 時仍須能運作。

---

## 環境變數

```
VITE_OER_API_KEY
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
```

型別定義於 `env.d.ts`。注意 `VITE_` 前綴的變數會被打包進前端 bundle（見 D6）。
