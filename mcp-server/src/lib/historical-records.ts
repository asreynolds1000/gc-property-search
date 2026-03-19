import { USER_AGENT, TIMEOUT_MS } from './constants.js'

const HISTORICAL_RECORDS_BASE = 'https://www.greenvillecounty.org/apps/Historical_Records_Search'
const IMAGE_BASE = `${HISTORICAL_RECORDS_BASE}/RecordsDirectory/Greenville%20County`

/**
 * Build the direct JPG URL for a historical record page.
 * @param path Full backslash-separated path (e.g., "\Probate Court\Will Books\Book B, 1820 - 1840")
 * @param page 1-based page number (zero-padded to 4 digits)
 */
export function buildHistoricalRecordUrl(path: string, page: number): string {
  // Convert backslash path to URL path segments
  const cleanPath = path.replace(/^\\/, '').replace(/\\/g, '/')
  if (!cleanPath || cleanPath.trim() === '') {
    throw new Error('Path is required. Use list_historical_records to discover volume paths.')
  }
  const paddedPage = String(page).padStart(4, '0')
  return `${IMAGE_BASE}/${encodeURIPath(cleanPath)}/${paddedPage}.jpg`
}

/**
 * Encode a path for use in a URL, preserving forward slashes.
 */
function encodeURIPath(path: string): string {
  return path.split('/').map(segment => encodeURIComponent(segment)).join('/')
}

/**
 * Fetch a historical record page image as a JPEG buffer.
 * Images are typically 55-502KB — small enough for LLM context without resizing.
 */
export async function fetchHistoricalRecordPage(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/jpeg,image/*;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (response.status === 404) {
      throw new Error(`Page not found. The volume may have fewer pages than expected. URL: ${url}`)
    }

    if (response.status === 403) {
      const body = await response.text()
      if (body.includes('_Incapsula_Resource') || body.includes('incapsula')) {
        throw new Error(`Request blocked by bot protection. Try again in 30 seconds or access directly in browser: ${url}`)
      }
      throw new Error(`Access denied (HTTP 403). URL: ${url}`)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}. URL: ${url}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('image/jpeg') && !contentType.includes('image/jpg')) {
      throw new Error(`Unexpected content type: ${contentType}. Expected JPEG. URL: ${url}`)
    }

    return Buffer.from(await response.arrayBuffer())
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch the Historical Records Search directory listing HTML.
 * @param path Optional backslash-separated path (e.g., "\Probate Court\Will Books").
 *             Omit for root listing of all offices.
 */
export async function fetchHistoricalRecordsHtml(path?: string): Promise<string> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    let url = `${HISTORICAL_RECORDS_BASE}/Default.aspx`
    if (path) {
      url += `?RecLoc=${encodeURIComponent(path)}`
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (response.status === 403) {
      const body = await response.text()
      if (body.includes('_Incapsula_Resource') || body.includes('incapsula')) {
        throw new Error('Request blocked by bot protection. Try again in 30 seconds.')
      }
      throw new Error(`Access denied (HTTP 403)`)
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch historical records listing: ${response.statusText}`)
    }

    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}
