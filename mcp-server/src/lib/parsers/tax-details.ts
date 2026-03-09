import type { TaxPropertyDetails } from '../../types/tax-details.js'

export const TAX_BASE_URL = 'https://www.greenvillecounty.org/appsas400/RealProperty/Details.aspx'

export function parseTaxDetailsHtml(html: string, pin: string, taxYear: string): TaxPropertyDetails {
  const details: TaxPropertyDetails = {
    mapNumber: pin,
    taxYear: taxYear,
    owners: [],
  }

  // Helper to extract value after a label
  function extractValue(label: string): string | undefined {
    const pattern = new RegExp(`${label}[:\\s]*</(?:td|th|span|label)>\\s*<(?:td|th|span)[^>]*>([^<]+)`, 'i')
    const match = html.match(pattern)
    return match ? match[1].trim() : undefined
  }

  // Helper to extract value from ASP.NET control by ID pattern
  function extractById(idPattern: string): string | undefined {
    const pattern = new RegExp(`id="[^"]*${idPattern}[^"]*"[^>]*>([^<]+)`, 'i')
    const match = html.match(pattern)
    return match ? match[1].trim() : undefined
  }

  // Owner(s) - may have multiple owners with relationship codes
  const ownerPattern = /Owner[^<]*<\/(?:td|th|label)>\s*<(?:td|th|span)[^>]*>([\s\S]*?)<\/(?:td|th|span)/gi
  let ownerMatch
  while ((ownerMatch = ownerPattern.exec(html)) !== null) {
    const ownerText = ownerMatch[1].replace(/<[^>]+>/g, '').trim()
    if (ownerText) {
      // Parse owner text - may contain multiple names with relationship codes
      const ownerLines = ownerText.split(/[,\n]/).map(s => s.trim()).filter(Boolean)
      for (const line of ownerLines) {
        // Check for relationship code in parentheses
        const relMatch = line.match(/\(([^)]+)\)/)
        const name = line.replace(/\([^)]+\)/g, '').trim()
        if (name) {
          details.owners.push({
            name,
            relationship: relMatch ? relMatch[1] : undefined,
          })
        }
      }
    }
  }

  // Previous Owner
  details.previousOwner = extractValue('Previous Owner')

  // Mailing Address
  details.mailingAddress = extractValue('Mailing Address')

  // Acreage
  details.acreage = extractValue('Acreage')

  // Description
  details.description = extractValue('Description')

  // Location
  details.location = extractValue('Location')

  // Subdivision
  details.subdivision = extractValue('Subdivision')

  // Deed Book-Page
  const deedBookPage = extractValue('Deed Book-Page') || extractById('DeedBook')
  if (deedBookPage) {
    const parts = deedBookPage.split(/[-\/]/).map(s => s.trim())
    if (parts.length >= 2) {
      details.deedBook = parts[0]
      details.deedPage = parts[1]
    }
  }

  // Deed Date
  details.deedDate = extractValue('Deed Date')

  // Sale Price
  const salePrice = extractValue('Sale Price')
  if (salePrice) {
    const priceNum = parseFloat(salePrice.replace(/[$,]/g, ''))
    if (!isNaN(priceNum)) {
      details.salePrice = priceNum
    }
  }

  // Plat Book-Page
  const platBookPage = extractValue('Plat Book-Page') || extractById('PlatBook')
  if (platBookPage) {
    const parts = platBookPage.split(/[-\/]/).map(s => s.trim())
    if (parts.length >= 2) {
      details.platBook = parts[0]
      details.platPage = parts[1]
    }
  }

  // Bedrooms/Bathrooms - format: "X Bedrooms, Y Bathrooms, Z Half Bathrooms"
  const bedroomsBathrooms = extractValue('Bedrooms/Bathrooms') || extractById('Bedrooms')
  if (bedroomsBathrooms) {
    const bedroomMatch = bedroomsBathrooms.match(/(\d+)\s*Bedroom/i)
    const bathroomMatch = bedroomsBathrooms.match(/(\d+)\s*Bathroom/i)
    const halfBathMatch = bedroomsBathrooms.match(/(\d+)\s*Half/i)

    if (bedroomMatch) details.bedrooms = parseInt(bedroomMatch[1])
    if (bathroomMatch) details.bathrooms = parseInt(bathroomMatch[1])
    if (halfBathMatch) details.halfBathrooms = parseInt(halfBathMatch[1])
  }

  // Square Footage
  const sqft = extractValue('Square Footage') || extractById('SquareFoot')
  if (sqft) {
    const sqftNum = parseInt(sqft.replace(/,/g, ''))
    if (!isNaN(sqftNum)) {
      details.squareFootage = sqftNum
    }
  }

  // Land Use - format: "1100 (Single Family)"
  const landUse = extractValue('Land Use') || extractById('LandUse')
  if (landUse) {
    const landUseMatch = landUse.match(/(\d+)\s*\(([^)]+)\)/)
    if (landUseMatch) {
      details.landUse = landUseMatch[1]
      details.landUseDescription = landUseMatch[2]
    } else {
      details.landUse = landUse
    }
  }

  // Jurisdiction
  details.jurisdiction = extractValue('Jurisdiction')

  // Homestead
  const homestead = extractValue('Homestead')
  if (homestead) {
    details.homestead = /yes/i.test(homestead)
  }

  // Assessment Class
  const assessmentClass = extractValue('Assessment Class')
  if (assessmentClass) {
    const classMatch = assessmentClass.match(/([A-Z]+)\s*[-\u2013]\s*(.+)/i)
    if (classMatch) {
      details.assessmentClass = classMatch[1]
      details.assessmentClassDescription = classMatch[2]
    } else {
      details.assessmentClass = assessmentClass
    }
  }

  // Fair Market Value
  const fmv = extractValue('Fair Market Value') || extractById('FairMarket')
  if (fmv) {
    const fmvNum = parseFloat(fmv.replace(/[$,]/g, ''))
    if (!isNaN(fmvNum)) {
      details.fairMarketValue = fmvNum
    }
  }

  // Taxable Market Value
  const tmv = extractValue('Taxable Market Value') || extractById('TaxableMarket')
  if (tmv) {
    const tmvNum = parseFloat(tmv.replace(/[$,]/g, ''))
    if (!isNaN(tmvNum)) {
      details.taxableMarketValue = tmvNum
    }
  }

  // Taxes -- may be in a direct value cell or nested in a <span> inside the <td>
  let taxes = extractValue('Taxes')
  if (!taxes) {
    // Fallback: extract from nested <span> inside <td> after Taxes label
    const taxSpanPattern = /Taxes[:\s]*<\/(?:td|th|span|label)>\s*<(?:td|th)[^>]*>\s*<span[^>]*>([^<]+)/i
    const taxSpanMatch = html.match(taxSpanPattern)
    if (taxSpanMatch) {
      taxes = taxSpanMatch[1].trim()
    }
  }
  if (taxes && !/not available/i.test(taxes)) {
    const taxNum = parseFloat(taxes.replace(/[$,]/g, ''))
    if (!isNaN(taxNum)) {
      details.taxes = taxNum
    }
  }

  return details
}
