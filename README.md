# Greenville County Property Search: property records for AI assistants

- **What:** An MCP server with 13 tools that search Greenville County, SC property records: GIS parcels, zoning and flood zones, tax assessments, vehicle and personal property tax, Register of Deeds documents, scanned archives back to the 1780s, and historical court records.
- **For:** Anyone researching Greenville County parcels, deeds and tax records with Claude or another MCP client. Alex Reynolds builds and maintains it. Next steps are tracked privately.
- **Runs:** As a local stdio server from the `gc-property-search-mcp` npm package (`npx gc-property-search-mcp`). A change reaches users when a new version is published to npm. Data comes live from gcgis.org and the county's tax, zoning, Register of Deeds and historical records sites. The electronic Register of Deeds tools need a county account, passed as `ROD_USERNAME` and `ROD_PASSWORD`.
- **Status:** Live (2026-11-23). npm shows version 1.1.1. The last code change was 2026-10-24.

Working notes for agents: `CLAUDE.md`.

## Tools

| Tool | Description | Auth |
|------|-------------|------|
| `search_properties` | Search by owner, PIN, address, or combined (up to 50 results) | None |
| `get_property_details` | Full property details: GIS + zoning + flood + tax + zoning history | None |
| `get_zoning_history` | Historical zoning cases | None |
| `get_tax_details` | Tax assessment: owners, valuations, sale history | None |
| `search_rod_documents` | Search Register of Deeds by name or book/page | ROD creds |
| `get_rod_document_page` | Fetch document page as PNG from electronic ROD viewer | ROD creds |
| `get_rod_archive_page` | Fetch scanned archive page as PNG (1780s to present) | None |
| `list_historical_records` | Browse historical court records directory (probate, common pleas, etc.) | None |
| `get_historical_record_page` | Fetch a page image from a historical record volume | None |
| `search_vehicle_tax` | Search vehicle tax records by name, VIN, or account | None |
| `get_vehicle_tax_details` | Vehicle detail: year/make/model/VIN, tax breakdown | None |
| `search_other_tax` | Search personal property tax: boats, aircraft, business, mobile homes | None |
| `get_other_tax_details` | Detailed personal property tax record | None |

## Installation

Claude Code:

```bash
claude mcp add gc-property-search-mcp -- npx gc-property-search-mcp
```

To include Register of Deeds credentials for document search and viewing:

```bash
claude mcp add gc-property-search-mcp \
  -e ROD_USERNAME=your_username \
  -e ROD_PASSWORD=your_password \
  -- npx gc-property-search-mcp
```

Other MCP clients:

```json
{
  "mcpServers": {
    "gc-property-search": {
      "command": "npx",
      "args": ["-y", "gc-property-search-mcp"],
      "env": {
        "ROD_USERNAME": "your-username",
        "ROD_PASSWORD": "your-password"
      }
    }
  }
}
```

### Requirements

- Node.js >= 20
- `pdftoppm` for archive page conversion (`brew install poppler`)
- ROD credentials only for the two electronic ROD tools

## Data sources

| Source | Coverage | Auth |
|--------|----------|------|
| [GIS (gcgis.org)](https://www.gcgis.org) | Property boundaries, owners, addresses, zoning, flood zones | Public |
| [Register of Deeds, electronic](https://viewer.greenvillecounty.org/countyweb) | Searchable index from about 1937 | Account required |
| [Register of Deeds, archive](https://greenvillecounty.org/apps/DirectoryListings/ROD_DirectoryListing/) | Scanned deeds, plats, indexes, land grants (1780s to present) | Public |
| [Historical Records Search](https://greenvillecounty.org/apps/Historical_Records_Search/) | Scanned court records: probate, common pleas, general sessions, sheriff | Public |
| Zoning and tax | Zoning history, real property tax, vehicle tax, personal property tax | Public |

## Known issues

The jurisdiction label in `search_properties` results is guessed from the PIN prefix and can say "Unincorporated Greenville County" for parcels inside a city. Do not rely on it for city or county questions. Check the tax district instead.

## Development

All code lives in `mcp-server/`.

```bash
git clone https://github.com/asreynolds1000/gc-property-search.git
cd gc-property-search/mcp-server
npm install
npm run build
npm test
npm run dev     # Run with tsx, no build step
```

## License

MIT
