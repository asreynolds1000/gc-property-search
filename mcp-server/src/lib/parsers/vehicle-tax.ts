import type { VehicleTaxResult, VehicleTaxDetail } from '../../types/vehicle-tax.js'

/**
 * Parse vehicle tax results HTML from VehicleTaxResults.aspx
 */
export function parseVehicleTaxResultsHtml(html: string): VehicleTaxResult[] {
  const results: VehicleTaxResult[] = []

  // Match table rows within tbl_Results
  const tableMatch = html.match(/<table[^>]*id="tbl_Results"[^>]*>([\s\S]*?)<\/table>/i)
  if (!tableMatch) return results

  const tableHtml = tableMatch[1]
  const rowPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch
  let isHeader = true

  while ((rowMatch = rowPattern.exec(tableHtml)) !== null) {
    // Skip header row
    if (isHeader) {
      isHeader = false
      continue
    }

    const rowHtml = rowMatch[1]
    const cells: string[] = []
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch
    while ((tdMatch = tdPattern.exec(rowHtml)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim())
    }

    if (cells.length < 5) continue

    // Extract name and VIN from first cell (e.g., "SMITH JOHN VIN#: 1HGBH41JXMN109186")
    const nameVinMatch = cells[0].match(/^(.*?)(?:\s*VIN#:\s*(.+))?$/)
    const name = nameVinMatch ? nameVinMatch[1].trim() : cells[0]
    const vin = nameVinMatch?.[2]?.trim() || ''

    // Extract district from taxes cell (e.g., "$80.16 District: 195")
    const taxDistrictMatch = cells[2].match(/^([\$\d.,]+)\s*District:\s*(\d+)/)
    const taxes = taxDistrictMatch ? taxDistrictMatch[1] : cells[2]
    const district = taxDistrictMatch ? taxDistrictMatch[2] : ''

    // Extract detail link params from the row HTML (handles both & and &amp;)
    const linkMatch = rowHtml.match(/VehicleTaxDetails\.aspx\?Year=([^&]+)(?:&amp;|&)Month=([^&]+)(?:&amp;|&)Receipt=([^&]+)(?:&amp;|&)Code=([^&]+)(?:&amp;|&)Suffix=([^"&]+)/)
    const detailParams = linkMatch
      ? { year: linkMatch[1], month: linkMatch[2], receipt: linkMatch[3], code: linkMatch[4], suffix: linkMatch[5] }
      : { year: '', month: '', receipt: '', code: '', suffix: '' }

    results.push({
      name,
      vin,
      accountNumber: cells[1],
      taxes,
      district,
      paid: cells[3],
      amountDue: cells[4],
      detailParams,
    })
  }

  return results
}

/**
 * Parse vehicle tax detail HTML from VehicleTaxDetails.aspx
 */
export function parseVehicleTaxDetailHtml(html: string): VehicleTaxDetail {
  function extractById(idSuffix: string): string | undefined {
    const pattern = new RegExp(`id="[^"]*${idSuffix}[^"]*"[^>]*>([^<]*)`, 'i')
    const match = html.match(pattern)
    return match ? match[1].trim() || undefined : undefined
  }

  return {
    name: extractById('lbl_Name') || '',
    levyYear: extractById('lbl_LevyYear') || '',
    accountNumber: extractById('lbl_Receipt') || '',
    vehicleYear: extractById('lbl_VehicleYear'),
    vehicleMake: extractById('lbl_VehicleMake'),
    vehicleModel: extractById('lbl_VehicleModel'),
    vehicleBody: extractById('lbl_VehicleBody'),
    vehicleWeight: extractById('lbl_VehicleWeight'),
    vin: extractById('lbl_VINNumber'),
    district: extractById('lbl_District'),
    expirationDate: extractById('lbl_ExpirationDate'),
    assessment: extractById('lbl_Assessment'),
    numberOfMonths: extractById('lbl_NumberOfMonths'),
    countyMillage: extractById('lbl_CountyMilage'),
    cityMillage: extractById('lbl_CityMilage'),
    totalTaxes: extractById('lbl_TotalTaxes'),
    roadFee: extractById('lbl_RoadFees'),
    dmvDecalFee: extractById('lbl_DMVRenewalFee'),
    processingFee: extractById('lbl_ProcessingFee'),
    highMileCredit: extractById('lbl_HighMileCredit'),
    totalBilled: extractById('lbl_TotalBilled'),
    totalPaid: extractById('lbl_TotalPaid'),
    balanceDue: extractById('lbl_BalanceDue'),
    datePaid: extractById('lbl_DatePaid'),
    status: extractById('lbl_Status'),
  }
}
