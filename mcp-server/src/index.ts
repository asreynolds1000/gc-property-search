#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { GreenvilleGIS } from './lib/api/gis-client.js'
import { GreenvilleROD } from './lib/api/rod-client.js'
import { parseTaxDetailsHtml } from './lib/parsers/tax-details.js'
import { parseZoningHtml } from './lib/parsers/zoning.js'
import { fetchTaxDetailsHtml, fetchZoningHtml, fetchVehicleTaxResultsHtml, fetchVehicleTaxDetailsHtml, fetchOtherTaxResultsHtml, fetchOtherTaxDetailsHtml } from './lib/fetchers.js'
import { parseVehicleTaxResultsHtml, parseVehicleTaxDetailHtml } from './lib/parsers/vehicle-tax.js'
import { parseOtherTaxResultsHtml, parseOtherTaxDetailHtml } from './lib/parsers/other-tax.js'
import { buildDeedArchiveUrl, buildPlatArchiveUrl, buildArchiveUrl, fetchArchivePageAsPng } from './lib/rod-archive.js'
import type { ArchiveCategory, IndexType } from './lib/rod-archive.js'

const gis = new GreenvilleGIS()

// ROD client -- created lazily on first use from env vars
let rod: GreenvilleROD | null = null
function getROD(): GreenvilleROD {
  if (!rod) {
    const username = process.env.ROD_USERNAME
    const password = process.env.ROD_PASSWORD
    if (!username || !password) {
      throw new Error('ROD_USERNAME and ROD_PASSWORD environment variables are required for Register of Deeds tools')
    }
    rod = new GreenvilleROD(username, password)
  }
  return rod
}

const server = new McpServer({
  name: 'gc-property-search',
  version: '1.0.0',
})

// -- search_properties -------------------------------------------------------
server.tool(
  'search_properties',
  'Search Greenville County properties by owner name, PIN, address, or combined query. Returns up to 50 results with zoning and flood zone info. Owner searches check both primary and secondary owner fields (useful for joint ownership). PINs may be numeric (e.g., 0544020103500) or letter-prefixed for municipalities (G=Greer, T=Taylors, M=Mauldin, S=Simpsonville). Use city to filter by city name (e.g., "TAYLORS", "GREENVILLE"). Note: GIS addresses lack street suffixes (St, Ct, Dr). When duplicate addresses are detected, a fullAddress field from the tax system is added to disambiguate. Each result includes a jurisdictionHint derived from the PIN prefix.',
  {
    query: z.string().describe('Search term: owner name, PIN, address, or combined'),
    type: z.enum(['owner', 'pin', 'address', 'combined']).optional().describe('Search type. Defaults to combined.'),
    street_number: z.number().optional().describe('Street number to narrow address searches'),
    city: z.string().optional().describe('City name to filter results (e.g., "TAYLORS", "GREENVILLE")'),
    exact_match: z.boolean().optional().describe('For address searches: match street name exactly instead of partial match'),
  },
  async ({ query, type, street_number, city, exact_match }) => {
    try {
      const searchType = type || 'combined'
      let features

      switch (searchType) {
        case 'owner':
          features = await gis.searchByOwner(query)
          break
        case 'pin':
          features = await gis.searchByPin(query)
          break
        case 'address':
          features = await gis.searchByAddress(query, street_number, city, exact_match)
          break
        case 'combined':
        default:
          features = await gis.searchCombined(query, city)
          break
      }

      // Cap at 50 results
      features = features.slice(0, 50)

      // Convert to properties and enrich with zoning/flood in parallel
      const properties = await Promise.all(
        features.map(async (feature) => {
          const prop = gis.featureToProperty(feature)

          // Enrich with zoning and flood zone if geometry available
          if (feature.geometry) {
            const [zoning, floodZone] = await Promise.all([
              gis.getZoning(feature.geometry).catch(() => null),
              gis.getFloodZone(feature.geometry).catch(() => 'Unknown'),
            ])
            prop.zoning = zoning
            prop.floodZone = floodZone
          }

          // Strip geometry from output (large, not useful in conversation)
          delete prop.geometry
          return prop
        })
      )

      // Detect address collisions and disambiguate with tax system location
      const addressCount = new Map<string, number>()
      for (const p of properties) {
        addressCount.set(p.address, (addressCount.get(p.address) || 0) + 1)
      }
      const ambiguousPins = properties
        .filter(p => (addressCount.get(p.address) || 0) > 1)
        .map(p => p.pin)

      if (ambiguousPins.length > 0) {
        const currentYear = new Date().getFullYear().toString()
        const taxResults = await Promise.all(
          ambiguousPins.map(pin =>
            fetchTaxDetailsHtml(pin)
              .then(html => ({ pin, location: parseTaxDetailsHtml(html, pin, currentYear).location }))
              .catch(() => ({ pin, location: undefined }))
          )
        )
        const locationByPin = new Map(taxResults.map(r => [r.pin, r.location]))
        for (const p of properties) {
          const loc = locationByPin.get(p.pin)
          if (loc) {
            p.fullAddress = loc
          }
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(properties, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error searching properties: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_property_details ----------------------------------------------------
server.tool(
  'get_property_details',
  'Get comprehensive details for a property by PIN. Fetches GIS data, zoning, flood zone, community info, tax details, and zoning history in parallel.',
  {
    pin: z.string().describe('Property PIN -- numeric (e.g., 0544020103500) or letter-prefixed for municipalities (e.g., G022000901401 for Greer, T for Taylors, M for Mauldin, S for Simpsonville)'),
  },
  async ({ pin }) => {
    try {
      // Fetch GIS property first to get geometry
      const features = await gis.searchByPin(pin)
      if (features.length === 0) {
        return {
          content: [{ type: 'text' as const, text: `No property found for PIN: ${pin}` }],
          isError: true,
        }
      }

      const feature = features[0]
      const property = gis.featureToProperty(feature)
      const geometry = feature.geometry

      // Parallel fetches for all enrichment data
      const [zoning, floodZone, communityInfo, taxDetailsHtml, zoningHtml] = await Promise.all([
        geometry ? gis.getZoning(geometry).catch(() => null) : null,
        geometry ? gis.getFloodZone(geometry).catch(() => 'Unknown') : 'Unknown',
        geometry ? gis.getCommunityInfo(geometry).catch(() => ({})) : {},
        fetchTaxDetailsHtml(pin).catch(() => null),
        fetchZoningHtml(pin).catch(() => null),
      ])

      // Parse fetched HTML
      const taxDetails = taxDetailsHtml
        ? parseTaxDetailsHtml(taxDetailsHtml, pin, new Date().getFullYear().toString())
        : null
      const zoningHistory = zoningHtml ? parseZoningHtml(zoningHtml) : []

      // Strip geometry
      delete property.geometry

      // Enrich with scanned archive URLs (pure logic, no HTTP)
      const archiveDeedUrl = buildDeedArchiveUrl(property.deedBook, property.deedPage)
      const archivePlatUrl = buildPlatArchiveUrl(property.platBook, property.platPage)

      const result = {
        property: {
          ...property,
          zoning,
          floodZone,
          ...communityInfo,
          ...(archiveDeedUrl && { archiveDeedUrl }),
          ...(archivePlatUrl && { archivePlatUrl }),
        },
        taxDetails,
        zoningHistory,
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching property details: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_zoning_history ------------------------------------------------------
server.tool(
  'get_zoning_history',
  'Get zoning case history for a property by PIN. Returns past zoning actions, docket numbers, and detail URLs.',
  {
    pin: z.string().describe('Property PIN -- numeric (e.g., 0544020103500) or letter-prefixed for municipalities (e.g., G022000901401 for Greer)'),
  },
  async ({ pin }) => {
    try {
      const html = await fetchZoningHtml(pin)
      const cases = parseZoningHtml(html)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(cases, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching zoning history: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_tax_details ---------------------------------------------------------
server.tool(
  'get_tax_details',
  'Get tax assessment details for a property by PIN. Returns owner info, valuations, sale history, and tax amounts.',
  {
    pin: z.string().describe('Property PIN -- numeric (e.g., 0544020103500) or letter-prefixed for municipalities (e.g., G022000901401 for Greer)'),
    year: z.string().optional().describe('Tax year. Defaults to current year.'),
  },
  async ({ pin, year }) => {
    try {
      const taxYear = year || new Date().getFullYear().toString()
      const html = await fetchTaxDetailsHtml(pin, taxYear)
      const details = parseTaxDetailsHtml(html, pin, taxYear)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(details, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching tax details: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- search_rod_documents ----------------------------------------------------
server.tool(
  'search_rod_documents',
  'Search Greenville County Register of Deeds for documents (deeds, mortgages, plats, mechanics liens). Search by owner/party name or by book/page reference. Name search supports date range, doc type, and grantor/grantee filtering. Returns up to 100 results -- use date_from/date_to to narrow large result sets. Results are deduplicated by instId; documents with multiple parties show all names in the names/otherNames arrays. The "name" field is the direct/primary party and "otherName" is the indirect/secondary party -- the mapping to grantor/grantee varies by document type. viewUrl requires an active ROD session in browser. Requires ROD credentials.',
  {
    search_type: z.enum(['name', 'book_page']).describe('Search by name or by book/page reference'),
    name: z.string().optional().describe('Owner/party name to search (required if search_type is "name")'),
    volume: z.enum(['DE', 'MT', 'PL']).optional().describe('Document volume: DE=Deed, MT=Mortgage, PL=Plat (required if search_type is "book_page")'),
    book: z.string().optional().describe('Book number (required if search_type is "book_page")'),
    page: z.string().optional().describe('Page number (required if search_type is "book_page")'),
    date_from: z.string().optional().describe('Start date MM/DD/YYYY (name search only)'),
    date_to: z.string().optional().describe('End date MM/DD/YYYY (name search only)'),
    doc_types: z.array(z.string()).optional().describe('Filter by type: DEED, MORTGAGE, PLAT, MECHANICS LIEN, etc. (name search only)'),
    party: z.enum(['grantor', 'grantee', 'both']).optional().describe('Search grantor, grantee, or both (default: both, name search only)'),
  },
  async ({ search_type, name, volume, book, page, date_from, date_to, doc_types, party }) => {
    try {
      const rodClient = getROD()
      let documents: import('./types/rod.js').RODDocument[]
      let uniqueDocuments: number

      if (search_type === 'name') {
        if (!name) {
          return {
            content: [{ type: 'text' as const, text: 'Error: "name" is required for name search' }],
            isError: true,
          }
        }
        const result = await rodClient.searchByName({
          name,
          dateFrom: date_from,
          dateTo: date_to,
          docTypes: doc_types,
          party,
        })
        documents = result.documents
        uniqueDocuments = result.uniqueDocuments
      } else {
        if (!volume || !book || !page) {
          return {
            content: [{ type: 'text' as const, text: 'Error: "volume", "book", and "page" are required for book/page search' }],
            isError: true,
          }
        }
        documents = await rodClient.searchByBookPage(volume, book, page)
        uniqueDocuments = documents.length
      }

      if (documents.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            totalRows: 0,
            uniqueDocuments: 0,
            message: 'No documents found. Tips: try "Last First" format, check spelling, or broaden date range. The ROD portal returns max 100 results -- use date_from/date_to to narrow large result sets.',
            grouped: {},
          }, null, 2) }],
        }
      }

      // Enrich with scanned archive URLs (pure logic, no HTTP)
      for (const doc of documents) {
        const desc = doc.instTypeDesc?.toUpperCase() || ''
        const category = desc.includes('PLAT') ? 'plats'
          : desc.includes('MORTGAGE') ? 'mortgages'
          : desc.includes('SATISFACTION') ? 'satisfactions'
          : desc.includes('AFFIDAVIT') ? 'affidavits'
          : 'deeds'
        const archiveUrl = buildArchiveUrl(
          category as ArchiveCategory,
          doc.book,
          parseInt(doc.page, 10),
        )
        if (archiveUrl) {
          doc.archiveUrl = archiveUrl
        }
      }

      // Group by document type for easier reading
      const grouped: Record<string, typeof documents> = {}
      for (const doc of documents) {
        const type = doc.instTypeDesc || 'OTHER'
        if (!grouped[type]) grouped[type] = []
        grouped[type].push(doc)
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          totalRows: documents.length,
          uniqueDocuments,
          grouped,
        }, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error searching ROD: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_rod_document_page ---------------------------------------------------
server.tool(
  'get_rod_document_page',
  'Fetch a specific page of a document from the Register of Deeds as a PNG image. Use search_rod_documents first to get the instId.',
  {
    inst_id: z.string().describe('Document instrument ID (from search_rod_documents results)'),
    page_number: z.coerce.number().default(1).describe('Page number to fetch (1-based). Defaults to 1.'),
    inst_num: z.string().optional().describe('Instrument number (optional, improves reliability)'),
    inst_type: z.string().optional().describe('Instrument type (optional, e.g., "DEED")'),
  },
  async ({ inst_id, page_number, inst_num, inst_type }) => {
    try {
      const rodClient = getROD()
      const imageBuffer = await rodClient.getDocumentPage(inst_id, page_number, inst_num, inst_type)

      if (!imageBuffer) {
        return {
          content: [{ type: 'text' as const, text: `No page ${page_number} found for document ${inst_id}. The document may have fewer pages.` }],
          isError: true,
        }
      }

      return {
        content: [{
          type: 'image' as const,
          data: imageBuffer.toString('base64'),
          mimeType: 'image/png',
        }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching document page: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- search_vehicle_tax ------------------------------------------------------
server.tool(
  'search_vehicle_tax',
  'Search Greenville County vehicle tax records by owner name (Last First format), VIN, or account number. Returns tax amounts, payment status, and detail link params for each vehicle.',
  {
    query: z.string().describe('Search term: owner name (Last First, e.g., "SMITH JOHN"), VIN, or account number'),
    search_type: z.enum(['Name', 'VIN', 'AccountNumber']).optional().describe('Search type. Defaults to Name.'),
  },
  async ({ query, search_type }) => {
    try {
      const type = search_type || 'Name'
      const html = await fetchVehicleTaxResultsHtml(type, query)
      const results = parseVehicleTaxResultsHtml(html)

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ results: [], message: 'No vehicle tax records found' }, null, 2) }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total: results.length, results }, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error searching vehicle tax: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_vehicle_tax_details -------------------------------------------------
server.tool(
  'get_vehicle_tax_details',
  'Get detailed vehicle tax record including vehicle info (year/make/model/VIN), tax breakdown, and payment status. Use params from search_vehicle_tax results.',
  {
    year: z.string().describe('Tax year'),
    month: z.string().describe('Tax month'),
    receipt: z.string().describe('Receipt number'),
    code: z.string().describe('Code'),
    suffix: z.string().describe('Suffix'),
  },
  async ({ year, month, receipt, code, suffix }) => {
    try {
      const html = await fetchVehicleTaxDetailsHtml(year, month, receipt, code, suffix)
      const detail = parseVehicleTaxDetailHtml(html)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(detail, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching vehicle tax details: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- search_other_tax --------------------------------------------------------
server.tool(
  'search_other_tax',
  'Search Greenville County personal property tax records for boats, aircraft, business furniture & equipment, mobile homes, and other non-vehicle/non-real-estate property. Name format: Last First.',
  {
    query: z.string().describe('Search term: owner name (Last First), account number, SCDOR ref ID, county file #, permit #, or boat/motor title #'),
    search_type: z.enum(['Name', 'AccountNumber', 'StateFileNumber', 'CountyFileNumber', 'PermitNumber', 'TitleNumber']).optional().describe('Search type. Defaults to Name.'),
  },
  async ({ query, search_type }) => {
    try {
      const type = search_type || 'Name'
      const html = await fetchOtherTaxResultsHtml(type, query)
      const results = parseOtherTaxResultsHtml(html)

      if (results.length === 0) {
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ results: [], message: 'No personal property tax records found' }, null, 2) }],
        }
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ total: results.length, results }, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error searching other tax: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_other_tax_details ---------------------------------------------------
server.tool(
  'get_other_tax_details',
  'Get detailed personal property tax record. Item code determines type: 10/30=Boat, 14/32=Boat Motor, 11=Aircraft, 08=Business F&E, 65/66=Mobile Home. Use params from search_other_tax results.',
  {
    year: z.string().describe('Tax year'),
    receipt: z.string().describe('Receipt number'),
    item: z.string().describe('Item code (determines property type)'),
    suffix: z.string().describe('Suffix'),
  },
  async ({ year, receipt, item, suffix }) => {
    try {
      const html = await fetchOtherTaxDetailsHtml(year, receipt, item, suffix)
      const detail = parseOtherTaxDetailHtml(html, item)

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(detail, null, 2) }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching other tax details: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- get_rod_archive_page ----------------------------------------------------
server.tool(
  'get_rod_archive_page',
  `Fetch a page from the Greenville County ROD scanned archive (historical records, 1780s-present). Returns the page as a PNG image. This archive is separate from the electronic ROD index -- it covers older records not in search_rod_documents.

Book naming by category:
- Deeds: Letters A-Z, AA-ZZ, AAA-ZZZ (oldest), then numbered 1-1230 (newer)
- Plats: Letters A-Z, AA-ZZ, AAA-ZZZ, then numbered "4-A" through "12-Z"
- Land Grants: Letters A-J (1784-1840s)
- Mortgages: Numbered 1-1696
- Affidavits: Numbered 1-42
- Satisfactions: Numbered 13-87
- Indexes: Use index_type + date_range. Book = letter section (A-Z). Date ranges: -1913, 1914-1949, 1950-1974, 1975-1989.
- Tax Maps: Book = edition name (e.g., "1998 Edition", "2005 Edition")

Pages are 1-based. Returns error with direct URL if page not found.
Tip: get_property_details and search_rod_documents include archiveUrl fields for documents in the scanned archive.`,
  {
    category: z.enum(['deeds', 'plats', 'indexes', 'land_grants', 'mortgages', 'affidavits', 'satisfactions', 'tax_maps']).describe('Document category'),
    book: z.string().describe('Book identifier: letter(s) for lettered books (A, AA, AAA), number for numbered books (198), letter section for indexes (H), "4-A" format for numbered plats'),
    page: z.coerce.number().describe('Page number (1-based)'),
    index_type: z.enum(['grantor', 'grantee', 'mortgagor', 'mortgagee', 'federal_tax_lien', 'plats']).optional().describe('For indexes only: which index to search'),
    date_range: z.string().optional().describe('For grantor/grantee/mortgagor/mortgagee indexes: -1913, 1914-1949, 1950-1974, or 1975-1989'),
  },
  async ({ category, book, page, index_type, date_range }) => {
    try {
      const url = buildArchiveUrl(
        category as ArchiveCategory,
        book,
        page,
        { indexType: index_type as IndexType | undefined, dateRange: date_range },
      )

      if (!url) {
        return {
          content: [{ type: 'text' as const, text: `Could not build archive URL for category=${category}, book=${book}, page=${page}. Check book format for this category.` }],
          isError: true,
        }
      }

      const pngBuffer = await fetchArchivePageAsPng(url)

      return {
        content: [{
          type: 'image' as const,
          data: pngBuffer.toString('base64'),
          mimeType: 'image/png',
        }],
      }
    } catch (error) {
      return {
        content: [{ type: 'text' as const, text: `Error fetching archive page: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      }
    }
  }
)

// -- Start server ------------------------------------------------------------
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
