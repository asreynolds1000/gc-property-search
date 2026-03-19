# Greenville County Property Search — MCP Server

MCP server for unified property search across Greenville County, SC systems: GIS, Register of Deeds, zoning, tax, and scanned archives (1780s–present).

## Tools (13)

| Tool | Description | Auth |
|------|-------------|------|
| `search_properties` | Search by owner, PIN, address, or combined (up to 50 results) | None |
| `get_property_details` | Full property details: GIS + zoning + flood + tax + zoning history | None |
| `get_zoning_history` | Historical zoning cases | None |
| `get_tax_details` | Tax assessment: owners, valuations, sale history | None |
| `search_rod_documents` | Search Register of Deeds by name or book/page | ROD creds |
| `get_rod_document_page` | Fetch document page as PNG from electronic ROD viewer | ROD creds |
| `get_rod_archive_page` | Fetch scanned archive page as PNG (1780s–present) | None |
| `list_historical_records` | Browse historical court records directory (probate, common pleas, etc.) | None |
| `get_historical_record_page` | Fetch a page image from a historical record volume | None |
| `search_vehicle_tax` | Search vehicle tax records by name, VIN, or account | None |
| `get_vehicle_tax_details` | Vehicle detail: year/make/model/VIN, tax breakdown | None |
| `search_other_tax` | Search personal property tax: boats, aircraft, business, mobile homes | None |
| `get_other_tax_details` | Detailed personal property tax record | None |

## Setup

```bash
cd mcp-server
npm install
npm run build
```

### Requirements

- Node.js >= 20
- `pdftoppm` for archive page conversion (`brew install poppler`)
- ROD credentials via `ROD_USERNAME`/`ROD_PASSWORD` env vars (only needed for electronic ROD tools)

### Claude Code / Claude Desktop

Add to your MCP config:

```json
{
  "mcpServers": {
    "gc-property-search": {
      "command": "node",
      "args": ["/path/to/gc-property-search/mcp-server/dist/index.js"],
      "env": {
        "ROD_USERNAME": "your-username",
        "ROD_PASSWORD": "your-password"
      }
    }
  }
}
```

## Data Sources

| Source | Coverage | Auth |
|--------|----------|------|
| [GIS (gcgis.org)](https://www.gcgis.org) | Property boundaries, owners, addresses, zoning, flood zones | Public |
| [Register of Deeds — Electronic](https://viewer.greenvillecounty.org/countyweb) | Searchable index ~1937+ | Account required |
| [Register of Deeds — Archive](https://greenvillecounty.org/apps/DirectoryListings/ROD_DirectoryListing/) | Scanned deeds, plats, indexes, land grants (1780s–present) | Public |
| [Historical Records Search](https://greenvillecounty.org/apps/Historical_Records_Search/) | Scanned court records: probate, common pleas, general sessions, sheriff | Public |
| Zoning & Tax | Zoning history, real property tax, vehicle tax, personal property tax | Public |

## Development

```bash
cd mcp-server
npm run dev     # Run with tsx (no build step)
npm test        # Run tests (118 tests)
```
