export type CurrencyCode = string

export interface CurrencyMeta {
  code: CurrencyCode
  name: string
  /** Minor-unit digits: 2 for USD, 0 for JPY, 3 for KWD. */
  decimals: number
}

/** Exchange rates keyed by currency code, all relative to USD. */
export type RateTable = Record<CurrencyCode, number>
