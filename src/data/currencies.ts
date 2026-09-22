import type { CurrencyCode, CurrencyMeta } from '@/types/currency'

/** Currencies with no minor unit at all. */
const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG',
  'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
])

/** Currencies whose minor unit is a thousandth. */
const THREE_DECIMAL = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

const NAMES: Record<string, string> = {
  AED: 'UAE Dirham', AFN: 'Afghan Afghani', ALL: 'Albanian Lek', AMD: 'Armenian Dram',
  ANG: 'Netherlands Antillean Guilder', AOA: 'Angolan Kwanza', ARS: 'Argentine Peso',
  AUD: 'Australian Dollar', AWG: 'Aruban Florin', AZN: 'Azerbaijani Manat',
  BAM: 'Bosnia-Herzegovina Mark', BBD: 'Barbadian Dollar', BDT: 'Bangladeshi Taka',
  BGN: 'Bulgarian Lev', BHD: 'Bahraini Dinar', BIF: 'Burundian Franc', BMD: 'Bermudan Dollar',
  BND: 'Brunei Dollar', BOB: 'Bolivian Boliviano', BRL: 'Brazilian Real', BSD: 'Bahamian Dollar',
  BTN: 'Bhutanese Ngultrum', BWP: 'Botswanan Pula', BYN: 'Belarusian Ruble', BZD: 'Belize Dollar',
  CAD: 'Canadian Dollar', CDF: 'Congolese Franc', CHF: 'Swiss Franc', CLP: 'Chilean Peso',
  CNY: 'Chinese Yuan', COP: 'Colombian Peso', CRC: 'Costa Rican Colon', CUP: 'Cuban Peso',
  CVE: 'Cape Verdean Escudo', CZK: 'Czech Koruna', DJF: 'Djiboutian Franc', DKK: 'Danish Krone',
  DOP: 'Dominican Peso', DZD: 'Algerian Dinar', EGP: 'Egyptian Pound', ERN: 'Eritrean Nakfa',
  ETB: 'Ethiopian Birr', EUR: 'Euro', FJD: 'Fijian Dollar', FKP: 'Falkland Islands Pound',
  GBP: 'British Pound', GEL: 'Georgian Lari', GHS: 'Ghanaian Cedi', GIP: 'Gibraltar Pound',
  GMD: 'Gambian Dalasi', GNF: 'Guinean Franc', GTQ: 'Guatemalan Quetzal', GYD: 'Guyanaese Dollar',
  HKD: 'Hong Kong Dollar', HNL: 'Honduran Lempira', HRK: 'Croatian Kuna', HTG: 'Haitian Gourde',
  HUF: 'Hungarian Forint', IDR: 'Indonesian Rupiah', ILS: 'Israeli Shekel', INR: 'Indian Rupee',
  IQD: 'Iraqi Dinar', IRR: 'Iranian Rial', ISK: 'Icelandic Krona', JMD: 'Jamaican Dollar',
  JOD: 'Jordanian Dinar', JPY: 'Japanese Yen', KES: 'Kenyan Shilling', KGS: 'Kyrgystani Som',
  KHR: 'Cambodian Riel', KMF: 'Comorian Franc', KRW: 'South Korean Won', KWD: 'Kuwaiti Dinar',
  KYD: 'Cayman Islands Dollar', KZT: 'Kazakhstani Tenge', LAK: 'Laotian Kip', LBP: 'Lebanese Pound',
  LKR: 'Sri Lankan Rupee', LRD: 'Liberian Dollar', LSL: 'Lesotho Loti', LYD: 'Libyan Dinar',
  MAD: 'Moroccan Dirham', MDL: 'Moldovan Leu', MGA: 'Malagasy Ariary', MKD: 'Macedonian Denar',
  MMK: 'Myanmar Kyat', MNT: 'Mongolian Tugrik', MOP: 'Macanese Pataca', MRU: 'Mauritanian Ouguiya',
  MUR: 'Mauritian Rupee', MVR: 'Maldivian Rufiyaa', MWK: 'Malawian Kwacha', MXN: 'Mexican Peso',
  MYR: 'Malaysian Ringgit', MZN: 'Mozambican Metical', NAD: 'Namibian Dollar', NGN: 'Nigerian Naira',
  NIO: 'Nicaraguan Cordoba', NOK: 'Norwegian Krone', NPR: 'Nepalese Rupee', NZD: 'New Zealand Dollar',
  OMR: 'Omani Rial', PAB: 'Panamanian Balboa', PEN: 'Peruvian Sol', PGK: 'Papua New Guinean Kina',
  PHP: 'Philippine Peso', PKR: 'Pakistani Rupee', PLN: 'Polish Zloty', PYG: 'Paraguayan Guarani',
  QAR: 'Qatari Rial', RON: 'Romanian Leu', RSD: 'Serbian Dinar', RUB: 'Russian Ruble',
  RWF: 'Rwandan Franc', SAR: 'Saudi Riyal', SBD: 'Solomon Islands Dollar', SCR: 'Seychellois Rupee',
  SDG: 'Sudanese Pound', SEK: 'Swedish Krona', SGD: 'Singapore Dollar', SHP: 'St. Helena Pound',
  SLE: 'Sierra Leonean Leone', SOS: 'Somali Shilling', SRD: 'Surinamese Dollar',
  SSP: 'South Sudanese Pound', STN: 'Sao Tomean Dobra', SYP: 'Syrian Pound', SZL: 'Swazi Lilangeni',
  THB: 'Thai Baht', TJS: 'Tajikistani Somoni', TMT: 'Turkmenistani Manat', TND: 'Tunisian Dinar',
  TOP: 'Tongan Paanga', TRY: 'Turkish Lira', TTD: 'Trinidad & Tobago Dollar', TWD: 'New Taiwan Dollar',
  TZS: 'Tanzanian Shilling', UAH: 'Ukrainian Hryvnia', UGX: 'Ugandan Shilling', USD: 'US Dollar',
  UYU: 'Uruguayan Peso', UZS: 'Uzbekistani Som', VES: 'Venezuelan Bolivar', VND: 'Vietnamese Dong',
  VUV: 'Vanuatu Vatu', WST: 'Samoan Tala', XAF: 'Central African CFA Franc',
  XCD: 'East Caribbean Dollar', XOF: 'West African CFA Franc', XPF: 'CFP Franc',
  YER: 'Yemeni Rial', ZAR: 'South African Rand', ZMW: 'Zambian Kwacha', ZWL: 'Zimbabwean Dollar',
}

function decimalsFor(code: CurrencyCode): number {
  if (ZERO_DECIMAL.has(code)) return 0
  if (THREE_DECIMAL.has(code)) return 3
  return 2
}

export const CURRENCIES: CurrencyMeta[] = Object.keys(NAMES)
  .sort()
  .map((code) => ({ code, name: NAMES[code] ?? code, decimals: decimalsFor(code) }))

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]))

export function currencyMeta(code: CurrencyCode): CurrencyMeta {
  return BY_CODE.get(code) ?? { code, name: code, decimals: 2 }
}

export function currencyName(code: CurrencyCode): string {
  return currencyMeta(code).name
}

export function isKnownCurrency(code: string): boolean {
  return BY_CODE.has(code)
}

/** Shown first in pickers before the user has expressed a preference. */
export const POPULAR_CURRENCIES: CurrencyCode[] = [
  'TWD', 'USD', 'JPY', 'EUR', 'KRW', 'CNY', 'HKD', 'GBP', 'SGD', 'THB', 'AUD', 'VND',
]

/** Maps an ISO country code to the currency people there actually spend. */
const COUNTRY_CURRENCY: Record<string, CurrencyCode> = {
  TW: 'TWD', US: 'USD', JP: 'JPY', KR: 'KRW', CN: 'CNY', HK: 'HKD', MO: 'MOP',
  SG: 'SGD', TH: 'THB', VN: 'VND', MY: 'MYR', ID: 'IDR', PH: 'PHP', IN: 'INR',
  GB: 'GBP', AU: 'AUD', NZ: 'NZD', CA: 'CAD', CH: 'CHF', SE: 'SEK', NO: 'NOK',
  DK: 'DKK', PL: 'PLN', CZ: 'CZK', TR: 'TRY', RU: 'RUB', BR: 'BRL', MX: 'MXN',
  ZA: 'ZAR', AE: 'AED', SA: 'SAR', IL: 'ILS', EG: 'EGP',
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  PT: 'EUR', IE: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
}

export function currencyForCountry(countryCode: string | undefined | null): CurrencyCode | null {
  if (!countryCode) return null
  return COUNTRY_CURRENCY[countryCode.toUpperCase()] ?? null
}
