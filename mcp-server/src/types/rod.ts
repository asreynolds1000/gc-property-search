// ROD (Register of Deeds) API types
// Based on Greenville County ROD viewer

export interface RODDocument {
  instId: string
  instNum: string
  book: string
  page: string
  recordDate: string
  isoDate?: string           // YYYY-MM-DD normalized from recordDate
  instTypeDesc: string       // "DEED", "MORTGAGE", "PLAT", etc.
  name: string               // Direct/primary name (role varies by doc type)
  otherName: string           // Indirect/secondary name (role varies by doc type)
  names: string[]             // All direct names (always populated, names[0] === name)
  otherNames: string[]        // All indirect names (always populated, otherNames[0] === otherName)
  legalDesc: string
  // URL to view document in ROD portal (requires active ROD session in browser).
  // Pattern sourced from ROD portal's docInfoView.do endpoint -- may change if portal is updated.
  viewUrl?: string
  pageCount?: number
  archiveUrl?: string         // URL to scanned archive page (if available)
}

export type RODVolume = 'DE' | 'MT' | 'PL' // Deed, Mortgage, Plat

export interface RODNameSearchOptions {
  name: string
  dateFrom?: string       // MM/DD/YYYY
  dateTo?: string         // MM/DD/YYYY
  docTypes?: string[]     // e.g. ['DEED', 'MORTGAGE']
  party?: 'grantor' | 'grantee' | 'both'  // default 'both'
}

export interface RODSearchResult {
  documents: RODDocument[]
  uniqueDocuments: number   // count after dedup by instId
}
