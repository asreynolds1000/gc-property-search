import type { OtherTaxResult, OtherTaxDetail } from '../../types/vehicle-tax.js'

const ITEM_CODE_MAP: Record<string, string> = {
  '07': 'Railroads & Pipelines',
  '08': 'Business Furniture & Equipment',
  '10': 'Boat',
  '11': 'Aircraft',
  '12': 'SC DOR - MFG Personal Property',
  '13': 'SC DOR - MFG',
  '14': 'Boat Motor',
  '15': 'SC DOR - Furniture, Fixtures & Equipment',
  '16': 'Personal Property Public Utility',
  '17': 'Department of Revenue Penalty',
  '18': 'Estimated Furniture/Fixtures',
  '30': 'Boat',
  '32': 'Boat Motor',
  '55': 'Rollback Lien',
  '65': 'Mobile Homes 6%',
  '66': 'Mobile Homes 4%',
  '70': 'Fee in Lieu of Taxes',
}

/**
 * Parse other tax results HTML from OtherTaxesResults.aspx
 *
 * Table has 7 grouped columns (not 14 flat), with <div> sub-values in each cell:
 *   Col 0: Name + Receipt Number (link)
 *   Col 1: Location + Sid # + Map #
 *   Col 2: Permit # + District
 *   Col 3: Exempt + Delinquent
 *   Col 4: Assessment + Date Paid
 *   Col 5: Base Amount + Amount Paid
 *   Col 6: Balance Due (red if unpaid)
 */
export function parseOtherTaxResultsHtml(html: string): OtherTaxResult[] {
  const results: OtherTaxResult[] = []

  // Extract tbody content to skip thead
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)
  if (!tbodyMatch) return results

  const tbodyHtml = tbodyMatch[1]
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowPattern.exec(tbodyHtml)) !== null) {
    const rowHtml = rowMatch[1]

    // Extract raw cell HTML (don't strip tags yet -- we need the link)
    const cellsRaw: string[] = []
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cellsRaw.push(tdMatch[1])
    }

    if (cellsRaw.length < 6) continue

    // Helper: strip tags and clean whitespace
    const clean = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()

    // Col 0: Name (in <span>) + Receipt Number (in <a> link)
    const nameMatch = cellsRaw[0].match(/<span[^>]*>([\s\S]*?)<\/span>/)
    const name = nameMatch ? clean(nameMatch[1]) : clean(cellsRaw[0])

    // Receipt number from link text
    const receiptTextMatch = cellsRaw[0].match(/<a[^>]*>([\s\S]*?)<\/a>/)
    const receiptNumber = receiptTextMatch ? clean(receiptTextMatch[1]) : ''

    // Extract detail link params (handles both & and &amp;)
    const linkMatch = cellsRaw[0].match(/OtherTaxesDetails\.aspx\?Year=([^&]+)(?:&amp;|&)Receipt=([^&]+)(?:&amp;|&)Item=([^&]+)(?:&amp;|&)Suffix=([^"'&]+)/)
    const detailParams = linkMatch
      ? { year: linkMatch[1], receipt: linkMatch[2], item: linkMatch[3], suffix: linkMatch[4] }
      : { year: '', receipt: '', item: '', suffix: '' }

    // Helper: extract sub-values from grouped cells preserving position
    // Each <div> is one slot; empty divs become empty strings to maintain index alignment
    const extractParts = (cellHtml: string): string[] => {
      const parts: string[] = []
      const divPattern = /<div[^>]*>([\s\S]*?)<\/div>/gi
      let divMatch
      while ((divMatch = divPattern.exec(cellHtml)) !== null) {
        parts.push(clean(divMatch[1]))
      }
      return parts
    }

    // Col 1: Location + Sid # + Map # (3 divs)
    const col1Parts = extractParts(cellsRaw[1])

    // Col 2: Permit # + District (2 divs)
    const col2Parts = extractParts(cellsRaw[2])

    // Col 3: Exempt + Delinquent (2 divs)
    const col3Parts = extractParts(cellsRaw[3])

    // Col 4: Assessment + Date Paid (2 divs)
    const col4Parts = extractParts(cellsRaw[4])

    // Col 5: Base Amount + Amount Paid (2 divs)
    const col5Parts = extractParts(cellsRaw[5])

    // Col 6: Balance Due
    const balanceDue = cellsRaw[6] ? clean(cellsRaw[6]) : undefined

    const orUndef = (s: string | undefined) => s || undefined

    results.push({
      name,
      receiptNumber,
      location: orUndef(col1Parts[0]),
      scheduleId: orUndef(col1Parts[1]),
      mapNumber: orUndef(col1Parts[2]),
      permitNumber: orUndef(col2Parts[0]),
      district: orUndef(col2Parts[1]),
      exempt: orUndef(col3Parts[0]),
      delinquent: orUndef(col3Parts[1]),
      assessment: orUndef(col4Parts[0]),
      datePaid: orUndef(col4Parts[1]),
      baseAmount: orUndef(col5Parts[0]),
      amountPaid: orUndef(col5Parts[1]),
      balanceDue: orUndef(balanceDue),
      detailParams,
    })
  }

  return results
}

/**
 * Parse other tax detail HTML from OtherTaxesDetails.aspx
 */
export function parseOtherTaxDetailHtml(html: string, itemCode: string): OtherTaxDetail {
  function extractById(idSuffix: string): string | undefined {
    const pattern = new RegExp(`id="[^"]*${idSuffix}[^"]*"[^>]*>([^<]*)`, 'i')
    const match = html.match(pattern)
    return match ? match[1].trim() || undefined : undefined
  }

  const detail: OtherTaxDetail = {
    name: extractById('lbl_Name') || '',
    levyYear: extractById('lbl_LevyYear') || '',
    receiptNumber: extractById('lbl_ReceiptNumber') || '',
    address: extractById('lbl_Address2'),
    cityStateZip: extractById('lbl_CityStateZip'),
    district: extractById('lbl_District'),
    exempt: extractById('lbl_Exempt'),
    delinquent: extractById('lbl_Delq'),
    assessment: extractById('lbl_Assessment'),
    appraisal: extractById('lbl_Appraisal'),
    countyMill: extractById('lbl_CountyMill'),
    cityMill: extractById('lbl_CityMill'),
    itemCode,
    propertyType: ITEM_CODE_MAP[itemCode] || `Unknown (${itemCode})`,
    // Tax summary
    taxWithoutPenalty: extractById('lbl_TaxWOPen'),
    taxPlusThreePercent: extractById('lbl_TaxPlusThreePercent'),
    taxPlusTenPercent: extractById('lbl_TaxPlusTenPercent'),
    taxWithCostPlusFifteenPercent: extractById('lbl_TaxWithCostPlusFifteenPercent'),
    totalTaxes: extractById('lbl_TotalTaxes'),
    miscCosts: extractById('lbl_MiscCosts'),
    totalBilled: extractById('lbl_TotalBilled'),
    totalPaid: extractById('lbl_TotalPaid'),
    balanceDue: extractById('lbl_BalanceDue'),
  }

  // Type-specific: Year/Title/Serial for boats, aircraft, boat motors (items 10, 11, 14, 30, 32)
  const yearTitleItems = ['10', '11', '14', '30', '32']
  if (yearTitleItems.includes(itemCode)) {
    detail.yearMakeModel = {
      year: extractById('lbl_YearTitleSer_Year'),
      make: extractById('lbl_YearTitleSer_Make'),
      model: extractById('lbl_YearTitleSer_Model'),
      title: extractById('lbl_YearTitleSer_Title'),
      serialNumber: extractById('lbl_YearTitleSer_SerialNumber'),
      length: extractById('lbl_YearTitleSer_Length'),
    }
  }

  return detail
}

export { ITEM_CODE_MAP }
