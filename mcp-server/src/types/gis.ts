// GIS (Geographic Information System) API types
// Based on Greenville County GIS MapServer

export interface GISParcel {
  PIN: string
  OWNAM1: string
  OWNAM2: string | null
  STREET: string
  STRNUM: number
  LOCATE: string // Full street address
  CITY: string
  STATE: string
  ZIP5: string
  POWNNM: string | null // Previous owner
  DEEDDATE: number | null // Unix ms
  CUBOOK: string | null // Current deed book
  CUPAGE: string | null // Current deed page
  PLTBK1: string | null // Plat book
  PPAGE1: string | null // Plat page
  DIST: string | null // Tax district
  SUBDIV: string | null // Subdivision name
  SLPRICE: number | null // Sale price
  FAIRMKTVAL: number | null // Fair market value
  TAXMKTVAL: number | null // Tax market value
  TACRES: number | null // Total acres
  SQFEET: number | null // Building sq ft
  BEDROOMS: number | null
  BATHRMS: number | null
  LANDUSE: string | null // Land use code
}

export interface GISGeometry {
  rings: number[][][]
}

export interface GISFeature {
  attributes: GISParcel
  geometry?: GISGeometry
}

export interface GISQueryResponse {
  features: GISFeature[]
  exceededTransferLimit?: boolean
}

export interface GISAutocompleteSuggestion {
  Suggest: string
  LayerField: string // e.g., "Tax Parcel-OWNAM1", "Site Address-ADDRESS"
}

export interface GISAutocompleteResponse {
  features: Array<{
    attributes: GISAutocompleteSuggestion
  }>
}

export type GISSearchType = 'owner' | 'pin' | 'address' | 'combined'

// Parsed property for UI display
export interface Property {
  pin: string
  owner1: string
  owner2: string | null
  address: string
  city: string
  state: string
  zip: string
  subdivision: string | null
  salePrice: number | null
  fairMarketValue: number | null
  taxValue: number | null
  acres: number | null
  sqft: number | null
  bedrooms: number | null
  bathrooms: number | null
  deedBook: string | null
  deedPage: string | null
  platBook: string | null
  platPage: string | null
  deedDate: Date | null
  zoning?: string | null
  floodZone?: string | null
  fullAddress?: string // Tax system location -- set only when address is ambiguous
  jurisdictionHint?: string // e.g., "Taylors", "Greer" -- derived from PIN prefix
  geometry?: GISGeometry
  // Community info
  taxDistrict?: string
  fireDistrict?: string
  sewerDistrict?: string
  sanitationDistrict?: string
  voterPrecinct?: string
  cityCouncil?: string
  countyCouncil?: string
  stateSenate?: string
  stateHouse?: string
  schoolTrustee?: string
  usCongress?: string
}
