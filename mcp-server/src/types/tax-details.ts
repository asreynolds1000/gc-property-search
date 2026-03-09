export interface TaxPropertyDetails {
  mapNumber: string
  taxYear: string

  // General info
  owners: Array<{
    name: string
    relationship?: string // e.g., "Jtw", "Jtwros"
  }>
  previousOwner?: string
  mailingAddress?: string

  // Description
  acreage?: string
  description?: string
  location?: string
  subdivision?: string

  // Deed/Plat references
  deedBook?: string
  deedPage?: string
  deedDate?: string
  salePrice?: number
  platBook?: string
  platPage?: string

  // Property info
  bedrooms?: number
  bathrooms?: number
  halfBathrooms?: number
  squareFootage?: number
  landUse?: string
  landUseDescription?: string

  // Classification
  jurisdiction?: string
  homestead?: boolean
  assessmentClass?: string
  assessmentClassDescription?: string

  // Values
  fairMarketValue?: number
  taxableMarketValue?: number
  taxes?: number
}
