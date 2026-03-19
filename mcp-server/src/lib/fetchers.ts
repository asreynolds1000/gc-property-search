import { USER_AGENT, TIMEOUT_MS } from './constants.js'

const TAX_BASE_URL = 'https://www.greenvillecounty.org/appsas400/RealProperty/Details.aspx'
const ZONING_BASE_URL = 'https://www.greenvillecounty.org/apps/zoning'
const VOTAXQRY_BASE_URL = 'https://www.greenvillecounty.org/appsas400/votaxqry'

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  return fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
}

export async function fetchTaxDetailsHtml(pin: string, year?: string): Promise<string> {
  const taxYear = year || new Date().getFullYear().toString()
  const url = `${TAX_BASE_URL}?MapNumber=${encodeURIComponent(pin)}&TaxYear=${taxYear}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch tax details: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchZoningHtml(pin: string): Promise<string> {
  const url = `${ZONING_BASE_URL}/Default.aspx?pin=${encodeURIComponent(pin)}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch zoning data: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchVehicleTaxResultsHtml(searchType: string, criteria: string): Promise<string> {
  const url = `${VOTAXQRY_BASE_URL}/VehicleTaxResults.aspx?SearchType=${encodeURIComponent(searchType)}&Criteria=${encodeURIComponent(criteria)}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle tax results: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchVehicleTaxDetailsHtml(year: string, month: string, receipt: string, code: string, suffix: string): Promise<string> {
  const url = `${VOTAXQRY_BASE_URL}/VehicleTaxDetails.aspx?Year=${encodeURIComponent(year)}&Month=${encodeURIComponent(month)}&Receipt=${encodeURIComponent(receipt)}&Code=${encodeURIComponent(code)}&Suffix=${encodeURIComponent(suffix)}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch vehicle tax details: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchOtherTaxResultsHtml(searchType: string, criteria: string): Promise<string> {
  const url = `${VOTAXQRY_BASE_URL}/OtherTaxesResults.aspx?SearchType=${encodeURIComponent(searchType)}&Criteria=${encodeURIComponent(criteria)}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch other tax results: ${response.statusText}`)
  }
  return response.text()
}

export async function fetchOtherTaxDetailsHtml(year: string, receipt: string, item: string, suffix: string): Promise<string> {
  const url = `${VOTAXQRY_BASE_URL}/OtherTaxesDetails.aspx?Year=${encodeURIComponent(year)}&Receipt=${encodeURIComponent(receipt)}&Item=${encodeURIComponent(item)}&Suffix=${encodeURIComponent(suffix)}`
  const response = await fetchWithTimeout(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch other tax details: ${response.statusText}`)
  }
  return response.text()
}
