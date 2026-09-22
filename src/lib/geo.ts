export interface GeoResult {
  label: string
  city: string
  countryCode: string | null
}

/**
 * Reverse-geocodes the device's position into a "City, Country" label.
 * Rejects if the user declines, the device has no fix, or the lookup fails —
 * callers are expected to treat location as best-effort.
 */
export async function detectLocation(timeoutMs = 10_000): Promise<GeoResult> {
  if (!('geolocation' in navigator)) throw new Error('geolocation-unsupported')

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: timeoutMs,
      maximumAge: 5 * 60 * 1000,
    })
  })

  const { latitude, longitude } = position.coords
  const response = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
  )
  if (!response.ok) throw new Error('reverse-geocode-failed')

  const data = (await response.json()) as {
    city?: string
    locality?: string
    principalSubdivision?: string
    countryName?: string
    countryCode?: string
  }

  const city = data.city || data.locality || data.principalSubdivision || ''
  const country = data.countryName || ''
  const label = [city, country].filter(Boolean).join(', ')

  return { label, city, countryCode: data.countryCode ?? null }
}
