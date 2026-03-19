# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Greenville County Property Search — MCP server for unified property search across GIS (public), ROD (authenticated), county zoning, tax, and scanned archive systems. Published as `gc-property-search-mcp` on npm.

**GitHub**: https://github.com/asreynolds1000/gc-property-search

## Commands

```bash
cd mcp-server
npm install     # Install dependencies
npm test        # Run tests
npm run build   # Compile to dist/
npm run dev     # Run with tsx (no build step)
```

## Architecture

All code lives in `mcp-server/`. The root package.json is a thin wrapper that delegates to `mcp-server/`.

```
mcp-server/
  src/
    index.ts              # Entry point, 13 MCP tools
    lib/
      api/gis-client.ts       # GIS API wrapper (public, no auth)
      api/rod-client.ts       # ROD API wrapper (session-based auth)
      constants.ts            # Shared USER_AGENT
      fetchers.ts             # HTML fetch helpers with 30s timeouts
      rod-archive.ts          # Scanned archive PDF→PNG pipeline
      historical-records.ts   # Historical Records Search URL builder + JPG fetcher
      parsers/                # HTML parsers (tax, zoning, vehicle, other, historical-records)
    types/                # TypeScript interfaces
    __tests__/            # Unit tests
  dist/                   # Compiled output (gitignored)
```

Runtime: Node.js >= 20, compiled with tsc (NodeNext module resolution). ROD credentials via `ROD_USERNAME`/`ROD_PASSWORD` env vars. Archive page conversion requires `pdftoppm` (from poppler, `brew install poppler`).

## MCP Tools (13)

| Tool | Description | Auth |
|------|-------------|------|
| `search_properties` | Search by owner, PIN, address, or combined. Up to 50 results with zoning/flood. | None |
| `get_property_details` | Full property details: GIS + zoning + flood + community + tax + zoning history. Includes archive URLs. | None |
| `get_zoning_history` | Historical zoning cases from county website. | None |
| `get_tax_details` | Tax assessment: owners, valuations, sale history. | None |
| `search_rod_documents` | Search Register of Deeds by name or book/page. Deduplicates, merges multi-party names. Volume defaults to DE (deeds). | ROD creds |
| `get_rod_document_page` | Fetch document page as PNG from electronic ROD viewer. Accepts inst_id or instId. | ROD creds |
| `get_rod_archive_page` | Fetch scanned archive page (1780s–present) as PNG. max_width controls output size (default 1200px). | None |
| `list_historical_records` | Browse historical court records directory (probate, common pleas, general sessions, sheriff, ROD, council). | None |
| `get_historical_record_page` | Fetch a page image (JPEG) from a historical record volume. Path from list_historical_records. | None |
| `search_vehicle_tax` | Search vehicle tax records by name, VIN, or account number. | None |
| `get_vehicle_tax_details` | Vehicle detail: year/make/model/VIN, tax breakdown. | None |
| `search_other_tax` | Search personal property tax: boats, aircraft, business F&E, mobile homes. | None |
| `get_other_tax_details` | Detailed personal property tax record. | None |

## External APIs

### GIS (gcgis.org)
- Public, no auth required
- ArcGIS REST API: `https://www.gcgis.org/arcgis3/rest/services/GreenvilleNJ`
- **Migrated Feb 2026** from `arcgis/GreenvilleJS` to `arcgis3/GreenvilleNJ` — monolithic MapServer split into dedicated services
- Field names unchanged (PIN, OWNAM1, STRNUM, LOCATE, etc.)

### Register of Deeds (ROD) — Electronic Index
- Requires account: https://viewer.greenvillecounty.org/countyweb
- Session-based auth with JSESSIONID cookies
- Covers ~1937+ (searchable by name, date, doc type)

### Register of Deeds (ROD) — Scanned Archive
- Public, no auth: `greenvillecounty.org/apps/DirectoryListings/ROD_DirectoryListing/`
- PDF pages converted to PNG via pdftoppm
- Covers 1780s–present: deeds, plats, indexes, land grants, mortgages, affidavits, satisfactions, tax maps

### Historical Records Search
- Public, no auth: `greenvillecounty.org/apps/Historical_Records_Search/`
- Scanned court documents (JPEG images, 55-502KB each)
- 6 offices: Probate Court, Court of Common Pleas, Court of General Sessions, Register of Deeds, Sheriff's Office, Council Commissioners
- Directory browsing via RecLoc query param; images are static files at predictable URLs
- Folder names have unpredictable formatting — must discover exact names via directory listing

### Zoning & Tax Systems
- Public endpoints, no auth
- HTML responses parsed server-side
- `greenvillecounty.org/apps/zoning/` - Zoning records
- `greenvillecounty.org/appsas400/RealProperty/` - Tax property details
- `greenvillecounty.org/appsas400/votaxqry/` - Vehicle & personal property tax

## Search Types

- `owner` - Search by owner name (OWNAM1 and OWNAM2 fields, handles joint ownership)
- `address` - Search by street address with optional number
- `pin` - Search by PIN (numeric or letter-prefixed: G=Greer, T=Taylors, M=Mauldin, S=Simpsonville)
- `combined` - **Default** - Searches owner AND address fields

## Cross-Reference Pattern

GIS returns book/page fields that link to ROD documents:
- `CUBOOK`/`CUPAGE` → Deed (volume "DE")
- `PLTBK1`/`PPAGE1` → Plat (volume "PL")

## API Reference

Full API documentation with endpoints and Python examples:
`docs/greenville_unified_property_api.md`

## Known Limitations

| Area | Limitation | Notes |
|------|-----------|-------|
| ROD Archive | Deed books end at 1230 | Books 1231+ are electronic-only — use search_rod_documents |
| ROD Archive | Plat groups end at 12 | Groups 13+ not in scanned archive |
| ROD Viewer | Pagination may fail on pre-2000 e-filed docs | viewImagePNG.do relies on server-side session state |
| Historical Records | Page counts are approximate | Actual pages may extend a few beyond reported count |
| Historical Records | Folder names are unpredictable | Must use exact names from list_historical_records |
| LOW | `doc_types` filter for some types | AGREEMENT, MISCELLANEOUS DEED may need different INSTTYPE codes |
