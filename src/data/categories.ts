import type { EntryCategory } from '@/types/models'

export interface CategoryMeta {
  code: EntryCategory
  emoji: string
  /** Chart colour; mid-tone so it reads on both light and dark surfaces. */
  color: string
}

/** The fixed list, in display order. Labels live in i18n under `category.<code>`. */
export const CATEGORIES: CategoryMeta[] = [
  { code: 'food', emoji: '🍜', color: '#f59e0b' },
  { code: 'transport', emoji: '🚃', color: '#3b82f6' },
  { code: 'lodging', emoji: '🏨', color: '#8b5cf6' },
  { code: 'shopping', emoji: '🛍️', color: '#ec4899' },
  { code: 'fun', emoji: '🎫', color: '#10b981' },
  { code: 'other', emoji: '📦', color: '#94a3b8' },
]

const CODES = new Set<string>(CATEGORIES.map((c) => c.code))

export function isCategory(value: unknown): value is EntryCategory {
  return typeof value === 'string' && CODES.has(value)
}

export function categoryEmoji(code: EntryCategory): string {
  return CATEGORIES.find((c) => c.code === code)?.emoji ?? '📦'
}

// Checked in order, so more specific words sit in earlier categories:
// "機場巴士" must hit transport before "巴士" could mean anything else.
const KEYWORDS: [EntryCategory, RegExp][] = [
  ['lodging', /飯店|酒店|旅館|旅店|民宿|住宿|青旅|hotel|hostel|airbnb|inn\b|ryokan|宿泊/i],
  [
    'transport',
    /機票|車票|高鐵|台鐵|捷運|地鐵|電車|新幹線|巴士|公車|客運|計程車|租車|加油|停車|渡輪|船票|交通|西瓜卡|suica|icoca|pasmo|jr\b|metro|subway|train|bus|taxi|uber|grab|flight|airline|fuel|parking|ferry|toll/i,
  ],
  [
    'food',
    /早餐|午餐|晚餐|宵夜|點心|餐|飯|麵|拉麵|壽司|燒肉|居酒屋|咖啡|飲料|茶|酒|甜點|便當|小吃|超商|便利商店|breakfast|lunch|dinner|brunch|snack|meal|food|cafe|coffee|tea|beer|drink|ramen|sushi|restaurant|bar\b/i,
  ],
  [
    'fun',
    /門票|入場|樂園|博物館|美術館|展覽|水族館|動物園|表演|演唱會|電影|溫泉|潛水|浮潛|體驗|導覽|tour|ticket|admission|museum|park|zoo|aquarium|show|concert|movie|onsen|diving|snorkel|activity/i,
  ],
  [
    'shopping',
    /伴手禮|紀念品|藥妝|購物|衣服|鞋|包|免稅|超市|百貨|outlet|souvenir|gift|shopping|clothes|shoes|drugstore|supermarket|mall/i,
  ],
]

/** Best guess from an entry title, or null when nothing matches. */
export function guessCategory(title: string): EntryCategory | null {
  const text = title.trim()
  if (!text) return null
  for (const [code, pattern] of KEYWORDS) {
    if (pattern.test(text)) return code
  }
  return null
}

export function categoryColor(code: EntryCategory): string {
  return CATEGORIES.find((c) => c.code === code)?.color ?? '#94a3b8'
}
