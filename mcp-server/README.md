# gc-property-search-mcp

MCP server for Greenville County, South Carolina property records. Provides 11 tools for searching and viewing GIS parcels, Register of Deeds documents, tax assessments, zoning history, vehicle/personal property tax, and scanned archive records dating back to the 1780s.

## Data Sources

| Source | Auth | Coverage |
|--------|------|----------|
| GIS (gcgis.org) | None | Parcel data, zoning, flood zones, community info |
| Tax System (greenvillecounty.org) | None | Tax assessments, valuations, sale history |
| Zoning System (greenvillecounty.org) | None | Historical zoning cases |
| Vehicle/Personal Property Tax | None | Vehicle tax, boats, aircraft, business F&E, mobile homes |
| Register of Deeds - Electronic Index | ROD account | Deeds, mortgages, plats (~1937-present) |
| Register of Deeds - Scanned Archive | None | Deeds, plats, indexes, land grants (1780s-present) |

## Installation

### Claude Code

```bash
claude mcp add gc-property-search-mcp -- npx gc-property-search-mcp
```

To include ROD credentials for document search/viewing:

```bash
claude mcp add gc-property-search-mcp \
  -e ROD_USERNAME=your_username \
  -e ROD_PASSWORD=your_password \
  -- npx gc-property-search-mcp
```

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "gc-property-search": {
      "command": "npx",
      "args": ["gc-property-search-mcp"],
      "env": {
        "ROD_USERNAME": "your_username",
        "ROD_PASSWORD": "your_password"
      }
    }
  }
}
```

## System Requirements

- **Node.js >= 20**
- **poppler** (optional, for `get_rod_archive_page` only)
  - macOS: `brew install poppler`
  - Linux: `apt install poppler-utils`

## Tools

### Property Search (no auth)

| Tool | Description |
|------|-------------|
| `search_properties` | Search by owner name, PIN, address, or combined query. Up to 50 results with zoning and flood zone. |
| `get_property_details` | Full property details: GIS + zoning + flood + community info + tax + zoning history. Includes archive URLs. |
| `get_zoning_history` | Historical zoning cases for a property. |
| `get_tax_details` | Tax assessment: owners, valuations, sale history, tax amounts. |

### Vehicle & Personal Property Tax (no auth)

| Tool | Description |
|------|-------------|
| `search_vehicle_tax` | Search by owner name (Last First), VIN, or account number. |
| `get_vehicle_tax_details` | Year/make/model/VIN, tax breakdown, payment status. |
| `search_other_tax` | Search boats, aircraft, business F&E, mobile homes. |
| `get_other_tax_details` | Detailed personal property tax record. |

### Register of Deeds (ROD credentials required for search/viewer)

| Tool | Description |
|------|-------------|
| `search_rod_documents` | Search by name or book/page. Deduplicates multi-party docs. Up to 100 results. |
| `get_rod_document_page` | Fetch a document page as PNG from the electronic viewer. |

### Scanned Archive (no auth, poppler required)

| Tool | Description |
|------|-------------|
| `get_rod_archive_page` | Fetch a page from the scanned archive (1780s-present) as PNG. Covers deeds, plats, indexes, land grants, mortgages, affidavits, satisfactions, tax maps. |

## Configuration

### ROD Credentials

Required only for `search_rod_documents` and `get_rod_document_page`. All other tools work without credentials.

Create a free account at https://viewer.greenvillecounty.org/ -- click "Create New User Account" under New Individual Account Registration.

Set credentials via environment variables:
- `ROD_USERNAME` - your ROD portal username
- `ROD_PASSWORD` - your ROD portal password

## Caveats

- **Depends on Greenville County public web services.** If they change URLs or HTML formats, tools may break. Please open an issue if you encounter errors.
- **ROD portal authentication** could change at any time. Session management handles cookie-based auth with automatic retry on session expiry.
- **Archive page tool requires poppler** (`pdftoppm`) for PDF-to-PNG conversion. Other tools work without it.
- **GIS addresses lack street suffixes** (St, Ct, Dr). Use the `fullAddress` field from tax system disambiguation when available.
- **ROD search returns max 100 results.** Use `date_from`/`date_to` to narrow large result sets.
- **Name format varies by system:** GIS uses "LAST FIRST", ROD uses "Last First", vehicle tax uses "LAST FIRST".

## Roadmap (v1.1+)

- Batch page fetch for multi-page documents
- `get_rod_document_info` (page count without fetching images)
- `get_rod_document_text` (OCR via tesseract)
- Legal description search
- Subdivision search
- Chain of title tool
- Archive URL verification

## Development

```bash
git clone https://github.com/asreynolds1000/gc-property-search.git
cd gc-property-search/mcp-server
npm install
npm test        # Run tests
npm run build   # Compile to dist/
npm run dev     # Run with tsx (no build step)
```

## License

MIT
