import type { HistoricalRecordEntry } from '../../types/historical-records.js'

/** Decode common HTML entities in text content */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * Parse the ASP.NET DataGrid HTML from the Historical Records Search app.
 * Extracts entries from the `dgItems` table (class="dirTable").
 *
 * Each row has 3 cells:
 *   - Name (LinkButton text)
 *   - Size: "N Item(s)" for folders, "N Viewable Page(s)" for volumes
 *   - Last Updated (date string)
 */
export function parseHistoricalRecordsHtml(html: string): HistoricalRecordEntry[] {
  const entries: HistoricalRecordEntry[] = []

  // Match each data row in the dgItems table.
  // Rows contain LinkButton (name), then two labels (size, last updated).
  // Skip header row (contains <th>) and footer row (contains "Item(s) Found").
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi
  let match

  while ((match = rowRegex.exec(html)) !== null) {
    const [, nameCell, sizeCell, dateCell] = match

    // Skip header rows (contain <th> or header text like "Name")
    if (nameCell.includes('<th') || sizeCell.includes('<th')) continue

    // Skip footer rows ("N Item(s) Found")
    if (sizeCell.includes('Found')) continue

    // Extract name from LinkButton or plain text
    const nameMatch = nameCell.match(/>([^<]+)<\/a>/i)
      || nameCell.match(/>([^<]+)<\/span>/i)
    if (!nameMatch) continue
    const name = decodeHtmlEntities(nameMatch[1].trim())
    if (!name) continue

    // Extract count and type from size cell
    // "N Item(s)" = folder, "N Viewable Page(s)" = volume
    const sizeText = sizeCell.replace(/<[^>]*>/g, '').trim()
    const sizeMatch = sizeText.match(/(\d+)\s+(Item|Viewable Page)/i)
    if (!sizeMatch) continue

    const count = parseInt(sizeMatch[1], 10)
    const type: 'folder' | 'volume' = sizeMatch[2].toLowerCase().startsWith('viewable') ? 'volume' : 'folder'

    // Extract last updated date
    const lastUpdated = dateCell.replace(/<[^>]*>/g, '').trim()

    entries.push({ name, count, lastUpdated, type })
  }

  return entries
}
