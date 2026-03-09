import type {
  GISFeature,
  GISQueryResponse,
  GISAutocompleteResponse,
  GISGeometry,
  Property,
} from '../../types/gis.js'

const GIS_BASE_URL =
  'https://www.gcgis.org/arcgis3/rest/services/GreenvilleNJ'

const OUT_SR = JSON.stringify({ wkid: 103146, vcsWkid: 105703 })

/**
 * Sanitize input for SQL WHERE clauses to prevent injection
 * Escapes single quotes and LIKE wildcards
 */
function sanitizeForSql(input: string, escapeLikeWildcards = true): string {
  // First escape single quotes (SQL standard)
  let sanitized = input.replace(/'/g, "''")

  // Escape LIKE wildcards if this will be used in a LIKE clause
  if (escapeLikeWildcards) {
    sanitized = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_')
  }

  return sanitized
}

/**
 * Validate PIN format - must be alphanumeric with optional dashes
 */
function isValidPin(pin: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(pin)
}

// New service structure: each category is a separate MapServer
const SERVICES = {
  TAX_PARCEL: 'Tax_Parcel_Search_and_Select/MapServer',
  SEARCH_QUERY: 'Search_and_Select_Query/MapServer',
  FEMA: 'FEMA/MapServer',
  AUTOCOMPLETE: 'AutoCompleteNJ/MapServer',
  TAXATION: 'TaxationDistrict/MapServer',
  POLITICAL: 'Political/MapServer',
} as const

// Layer IDs within each service
const LAYERS = {
  TAX_PARCEL: { service: SERVICES.TAX_PARCEL, layer: 0 },
  ZONING: { service: SERVICES.SEARCH_QUERY, layer: 3 },
  FLOOD_ZONE: { service: SERVICES.FEMA, layer: 8 },
  AUTOCOMPLETE: { service: SERVICES.AUTOCOMPLETE, layer: 0 },
  // Community info -- TaxationDistrict service
  TAX_DISTRICT: { service: SERVICES.TAXATION, layer: 2 },
  FIRE_DISTRICT: { service: SERVICES.TAXATION, layer: 4 },
  SEWER_DISTRICT: { service: SERVICES.TAXATION, layer: 1 },
  SANITATION_DISTRICT: { service: SERVICES.TAXATION, layer: 0 },
  // Community info -- Political service
  VOTER_PRECINCT: { service: SERVICES.POLITICAL, layer: 1 },
  CITY_COUNCIL: { service: SERVICES.POLITICAL, layer: 2 },
  COUNTY_COUNCIL: { service: SERVICES.POLITICAL, layer: 4 },
  STATE_SENATE: { service: SERVICES.POLITICAL, layer: 5 },
  STATE_HOUSE: { service: SERVICES.POLITICAL, layer: 13 },
  SCHOOL_TRUSTEE: { service: SERVICES.POLITICAL, layer: 7 },
  US_CONGRESS: { service: SERVICES.POLITICAL, layer: 8 },
}

export interface CommunityInfo {
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

/**
 * Derive jurisdiction from PIN prefix.
 * PIN first character encodes the tax district / geographic area.
 */
export function jurisdictionFromPin(pin: string): string | undefined {
  const prefix = pin.charAt(0).toUpperCase()
  const map: Record<string, string> = {
    T: 'Taylors',
    G: 'Greer',
    M: 'Mauldin',
    P: 'Parker',
    S: 'Simpsonville',
  }
  if (map[prefix]) return map[prefix]
  if (prefix >= '0' && prefix <= '9') return 'Unincorporated Greenville County'
  return undefined
}

export class GreenvilleGIS {
  private async query(
    serviceLayer: { service: string; layer: number },
    params: Record<string, string>
  ): Promise<GISQueryResponse> {
    const url = new URL(
      `${GIS_BASE_URL}/${serviceLayer.service}/${serviceLayer.layer}/query`
    )
    url.searchParams.set('f', 'json')
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value)
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url.toString(), { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`GIS query failed: ${response.statusText}`)
      }
      return response.json()
    } finally {
      clearTimeout(timeout)
    }
  }

  async queryParcels(
    whereClause: string,
    returnGeometry = true
  ): Promise<GISFeature[]> {
    const data = await this.query(LAYERS.TAX_PARCEL, {
      where: whereClause,
      returnGeometry: String(returnGeometry),
      outFields: '*',
      outSR: OUT_SR,
      spatialRel: 'esriSpatialRelIntersects',
    })
    return data.features || []
  }

  async searchByOwner(name: string): Promise<GISFeature[]> {
    // Sanitize name for SQL LIKE query - escape quotes and wildcards
    const cleanName = sanitizeForSql(name.toUpperCase())
    // Search both primary and secondary owner fields (handles joint ownership)
    const results = await this.queryParcels(
      `OWNAM1 LIKE '${cleanName}%' ESCAPE '\\' OR OWNAM2 LIKE '${cleanName}%' ESCAPE '\\'`
    )

    // If no results and query has 2+ words, swap first/last word and retry
    // Handles "First Last" -> "Last First" since GIS stores "LAST FIRST"
    if (results.length === 0) {
      const words = cleanName.split(/\s+/).filter(Boolean)
      if (words.length >= 2) {
        const swapped = [words[words.length - 1], ...words.slice(0, -1)].join(' ')
        return this.queryParcels(
          `OWNAM1 LIKE '${swapped}%' ESCAPE '\\' OR OWNAM2 LIKE '${swapped}%' ESCAPE '\\'`
        )
      }
    }

    return results
  }

  async searchByPin(pin: string): Promise<GISFeature[]> {
    // Validate PIN format to prevent injection
    if (!isValidPin(pin)) {
      return []
    }
    return this.queryParcels(`PIN = '${pin}'`)
  }

  async searchByAddress(
    street: string,
    number?: number,
    city?: string,
    exactMatch?: boolean
  ): Promise<GISFeature[]> {
    const cleanStreet = sanitizeForSql(street.toUpperCase(), !exactMatch)
    let where = exactMatch
      ? `LOCATE = '${cleanStreet}'`
      : `LOCATE LIKE '%${cleanStreet}%' ESCAPE '\\'`
    if (number && Number.isInteger(number) && number > 0) {
      where += ` AND STRNUM = '${number}'`
    }
    if (city) {
      const cleanCity = sanitizeForSql(city.toUpperCase(), false)
      where += ` AND CITY = '${cleanCity}'`
    }
    return this.queryParcels(where)
  }

  async searchCombined(query: string, city?: string): Promise<GISFeature[]> {
    // Split query into terms, filter short words, sanitize each term
    const terms = query
      .toUpperCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .map((t) => sanitizeForSql(t))

    if (terms.length === 0) {
      return []
    }

    // Build WHERE clause: all terms must match in owner (primary or secondary) OR address
    const owner1Conditions = terms.map((t) => `OWNAM1 LIKE '%${t}%' ESCAPE '\\'`).join(' AND ')
    const owner2Conditions = terms.map((t) => `OWNAM2 LIKE '%${t}%' ESCAPE '\\'`).join(' AND ')
    const addressConditions = terms.map((t) => `LOCATE LIKE '%${t}%' ESCAPE '\\'`).join(' AND ')

    let where = `(${owner1Conditions}) OR (${owner2Conditions}) OR (${addressConditions})`
    if (city) {
      const cleanCity = sanitizeForSql(city.toUpperCase(), false)
      where = `(${where}) AND CITY = '${cleanCity}'`
    }
    return this.queryParcels(where)
  }

  async getZoning(geometry: GISGeometry): Promise<string | null> {
    const data = await this.query(LAYERS.ZONING, {
      geometry: JSON.stringify({ rings: geometry.rings }),
      geometryType: 'esriGeometryPolygon',
      inSR: '6570',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ZONING',
      returnGeometry: 'false',
    })

    const features = data.features || []
    if (features.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (features[0].attributes as any)['ZONING'] || null
    }
    return null
  }

  async getFloodZone(geometry: GISGeometry): Promise<string> {
    const data = await this.query(LAYERS.FLOOD_ZONE, {
      geometry: JSON.stringify({ rings: geometry.rings }),
      geometryType: 'esriGeometryPolygon',
      inSR: '6570',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE',
      returnGeometry: 'false',
    })

    const features = data.features || []
    if (features.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (features[0].attributes as any)['FLD_ZONE'] || 'X (Not in flood zone)'
    }
    return 'X (Not in flood zone)'
  }

  private async queryLayerAttribute(
    serviceLayer: { service: string; layer: number },
    geometry: GISGeometry,
    fieldName: string
  ): Promise<string | null> {
    try {
      const data = await this.query(serviceLayer, {
        geometry: JSON.stringify({ rings: geometry.rings }),
        geometryType: 'esriGeometryPolygon',
        inSR: '6570',
        spatialRel: 'esriSpatialRelIntersects',
        outFields: fieldName,
        returnGeometry: 'false',
      })

      const features = data.features || []
      if (features.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (features[0].attributes as any)[fieldName] || null
      }
    } catch {
      // Ignore errors for individual layer queries
    }
    return null
  }

  async getCommunityInfo(geometry: GISGeometry): Promise<CommunityInfo> {
    // Query all community info layers in parallel
    const [
      taxDistrict,
      fireDistrict,
      sewerDistrict,
      sanitationDistrict,
      voterPrecinct,
      cityCouncil,
      countyCouncil,
      stateSenate,
      stateHouse,
      schoolTrustee,
      usCongress,
    ] = await Promise.all([
      this.queryLayerAttribute(LAYERS.TAX_DISTRICT, geometry, 'TDISTNUM'),
      this.queryLayerAttribute(LAYERS.FIRE_DISTRICT, geometry, 'FIREDIST'),
      this.queryLayerAttribute(LAYERS.SEWER_DISTRICT, geometry, 'SEWERDIST'),
      this.queryLayerAttribute(LAYERS.SANITATION_DISTRICT, geometry, 'SANITATIONDIST'),
      this.queryLayerAttribute(LAYERS.VOTER_PRECINCT, geometry, 'name'),
      this.queryLayerAttribute(LAYERS.CITY_COUNCIL, geometry, 'DISTRICT'),
      this.queryLayerAttribute(LAYERS.COUNTY_COUNCIL, geometry, 'DISTRICT'),
      this.queryLayerAttribute(LAYERS.STATE_SENATE, geometry, 'DISTRICT'),
      this.queryLayerAttribute(LAYERS.STATE_HOUSE, geometry, 'DISTRICT'),
      this.queryLayerAttribute(LAYERS.SCHOOL_TRUSTEE, geometry, 'DISTRICT'),
      this.queryLayerAttribute(LAYERS.US_CONGRESS, geometry, 'DISTRICT'),
    ])

    return {
      taxDistrict: taxDistrict || undefined,
      fireDistrict: fireDistrict || undefined,
      sewerDistrict: sewerDistrict || undefined,
      sanitationDistrict: sanitationDistrict || undefined,
      voterPrecinct: voterPrecinct || undefined,
      cityCouncil: cityCouncil || undefined,
      countyCouncil: countyCouncil || undefined,
      stateSenate: stateSenate || undefined,
      stateHouse: stateHouse || undefined,
      schoolTrustee: schoolTrustee || undefined,
      usCongress: usCongress || undefined,
    }
  }

  async autocomplete(
    text: string
  ): Promise<Array<{ text: string; type: string }>> {
    const url = new URL(
      `${GIS_BASE_URL}/${LAYERS.AUTOCOMPLETE.service}/${LAYERS.AUTOCOMPLETE.layer}/query`
    )
    const sanitizedText = sanitizeForSql(text.toUpperCase())
    url.searchParams.set('f', 'json')
    url.searchParams.set('where', `Suggest LIKE '${sanitizedText}%' ESCAPE '\\'`)
    url.searchParams.set('returnGeometry', 'false')
    url.searchParams.set('outFields', 'Suggest,LayerField')
    url.searchParams.set('resultRecordCount', '10')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    let data: GISAutocompleteResponse
    try {
      const response = await fetch(url.toString(), { signal: controller.signal })
      if (!response.ok) {
        throw new Error(`Autocomplete failed: ${response.statusText}`)
      }
      data = await response.json()
    } finally {
      clearTimeout(timeout)
    }
    return (data.features || []).map((f) => ({
      // Strip the suffix (e.g., "~3" or "~1^9") from autocomplete suggestions
      text: f.attributes.Suggest.replace(/~[\d^]+$/, ''),
      type: f.attributes.LayerField,
    }))
  }

  // Convert GIS feature to Property object
  featureToProperty(feature: GISFeature): Property {
    const attrs = feature.attributes
    return {
      pin: attrs.PIN,
      owner1: attrs.OWNAM1,
      owner2: attrs.OWNAM2,
      address: `${attrs.STRNUM || ''} ${attrs.LOCATE || ''}`.trim(),
      city: attrs.CITY,
      state: attrs.STATE,
      zip: attrs.ZIP5,
      subdivision: attrs.SUBDIV,
      salePrice: attrs.SLPRICE,
      fairMarketValue: attrs.FAIRMKTVAL,
      taxValue: attrs.TAXMKTVAL,
      acres: attrs.TACRES,
      sqft: attrs.SQFEET,
      bedrooms: attrs.BEDROOMS,
      bathrooms: attrs.BATHRMS,
      deedBook: attrs.CUBOOK,
      deedPage: attrs.CUPAGE,
      platBook: attrs.PLTBK1,
      platPage: attrs.PPAGE1,
      deedDate: attrs.DEEDDATE ? new Date(attrs.DEEDDATE) : null,
      jurisdictionHint: jurisdictionFromPin(attrs.PIN),
      geometry: feature.geometry,
    }
  }
}

// Singleton instance for server-side use
export const gis = new GreenvilleGIS()
