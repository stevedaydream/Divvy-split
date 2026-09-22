import type { Timestamp } from 'firebase/firestore'
import type { CurrencyCode } from './currency'

/** Bank details a member shows others so they can be paid back. */
export interface PaymentInfo {
  bankName: string
  bankAccount: string
  /** LINE ID for LINE Pay transfers. Absent on profiles saved before it existed. */
  lineId?: string
}

export interface UserProfile {
  uid: string
  nickname: string
  email: string
  /** The member's own preferred display currency. */
  currency: CurrencyCode
  /** ISO 3166-1 alpha-2 code of the member's home country, or empty. */
  country: string
  payment: PaymentInfo | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

/** The slice of a member's profile that is denormalised into the group doc. */
export interface GroupMember {
  nickname: string
  payment: PaymentInfo | null
}

export interface Group {
  id: string
  name: string
  /** Every amount in the group settles into this currency. */
  currency: CurrencyCode
  /** ISO 3166-1 alpha-2 code of the trip's destination country, or empty. */
  destination: string
  /** Free-text city or area within the destination, e.g. "Tokyo". */
  location: string
  ownerId: string
  /** Kept flat so Firestore can query it with `array-contains`. */
  memberIds: string[]
  /** Denormalised member profiles — avoids an N+1 read per snapshot. */
  members: Record<string, GroupMember>
  /** Secret half of the invite link; readable only by members. */
  inviteCode: string
  archived: boolean
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export type EntryType = 'expense' | 'settlement'

/** How a settlement was paid, when the app helped make the payment. */
export type SettlementMethod = 'linepay'

/** Fixed spending categories; see `data/categories.ts`. */
export type EntryCategory = 'food' | 'transport' | 'lodging' | 'shopping' | 'fun' | 'other'

/**
 * One line in a group's ledger.
 *
 * `expense`    — payer fronted `amountMinor` on behalf of `participantIds`.
 * `settlement` — payer transferred `amountMinor` to the single participant.
 *
 * Amounts are integers in the currency's minor unit (cents, yen, won) so that
 * balances never accumulate floating-point error. `rate` is captured at write
 * time, so editing an old entry never re-prices it at today's rate.
 */
export interface Entry {
  id: string
  groupId: string
  type: EntryType
  title: string
  payerId: string
  participantIds: string[]
  amountMinor: number
  currency: CurrencyCode
  /** Units of the group currency per 1 unit of `currency`, at write time. */
  rate: number
  /** `amountMinor` converted into the group currency's minor unit. */
  groupAmountMinor: number
  method: SettlementMethod | null
  category: EntryCategory
  /** Free text, only offered for the `other` category. */
  note: string
  /** Day the money was spent, `YYYY-MM-DD`. Not the same as `createdAt`. */
  date: string
  createdAt: Timestamp | null
  createdBy: string
}

/** A `from -> to` transfer proposed by the settlement planner. */
export interface Transfer {
  from: string
  to: string
  amountMinor: number
}
