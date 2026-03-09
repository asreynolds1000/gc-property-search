import type { ZoningCase } from '../../types/zoning.js'

export const ZONING_BASE_URL = 'https://www.greenvillecounty.org/apps/zoning'

export function parseZoningHtml(html: string): ZoningCase[] {
  const cases: ZoningCase[] = []

  // Look for table rows with zoning case data
  // The ASP.NET page uses a GridView, so we look for table rows with links to Details.aspx
  const detailLinkPattern = /Details\.aspx\?RecID=(\d+)/g
  const matches = html.matchAll(detailLinkPattern)

  // Extract unique RecIDs
  const recIds = new Set<string>()
  for (const match of matches) {
    recIds.add(match[1])
  }

  // For each RecID, try to extract the row data
  // The table structure is typically: Year | Docket | PIN | Address | Action
  for (const recId of recIds) {
    // Find the row containing this RecID link
    const rowPattern = new RegExp(
      `<tr[^>]*>(?:(?!</tr>).)*Details\\.aspx\\?RecID=${recId}(?:(?!</tr>).)*</tr>`,
      'is'
    )
    const rowMatch = html.match(rowPattern)

    if (rowMatch) {
      const rowHtml = rowMatch[0]

      // Extract cell values - look for <td> or <span> content
      const cellPattern = /<(?:td|span)[^>]*>([^<]*)</g
      const cells: string[] = []
      let cellMatch
      while ((cellMatch = cellPattern.exec(rowHtml)) !== null) {
        const value = cellMatch[1].trim()
        if (value && !value.includes('href')) {
          cells.push(value)
        }
      }

      // Also look for link text
      const linkTextPattern = /<a[^>]*>([^<]+)</g
      while ((cellMatch = linkTextPattern.exec(rowHtml)) !== null) {
        const value = cellMatch[1].trim()
        if (value && value !== 'Details') {
          cells.push(value)
        }
      }

      // Try to identify year (4 digit number)
      const yearMatch = rowHtml.match(/\b(19\d{2}|20\d{2})\b/)
      const year = yearMatch ? yearMatch[1] : ''

      // Try to identify docket number (typically like ZA-2023-001 or similar)
      const docketMatch = rowHtml.match(/\b([A-Z]{1,3}-?\d{2,4}-?\d{1,4})\b/i)
      const docketNumber = docketMatch ? docketMatch[1] : ''

      cases.push({
        recId,
        year: year || cells[0] || '',
        docketNumber: docketNumber || cells[1] || '',
        description: cells.find(c => c.length > 20) || '',
        action: cells.find(c => /approved|denied|withdrawn|pending/i.test(c)) || '',
        detailUrl: `${ZONING_BASE_URL}/Details.aspx?RecID=${recId}`,
      })
    } else {
      // Fallback: just add the basic info
      cases.push({
        recId,
        year: '',
        docketNumber: '',
        detailUrl: `${ZONING_BASE_URL}/Details.aspx?RecID=${recId}`,
      })
    }
  }

  // Sort by year descending (most recent first)
  cases.sort((a, b) => {
    const yearA = parseInt(a.year) || 0
    const yearB = parseInt(b.year) || 0
    return yearB - yearA
  })

  return cases
}
