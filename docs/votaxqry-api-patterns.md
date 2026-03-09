# Greenville County Vehicle & Other Personal Property Tax API Patterns

Source: HAR capture from `https://www.greenvillecounty.org/appsas400/votaxqry/` + live endpoint testing (March 2026).

## Overview

The `votaxqry` system covers three tax categories via a single search form:

| Category | Hidden Field Value | Results Page | Detail Page |
|----------|--------------------|--------------|-------------|
| **Vehicles** | `Car` | `VehicleTaxResults.aspx` | `VehicleTaxDetails.aspx` |
| **Real Estate** | `Real Estate` | `RealTaxesResults.aspx` | Redirects to `/appsas400/RealProperty/Details.aspx` |
| **Other** (boats, business property, mobile homes, etc.) | `Other` | `OtherTaxesResults.aspx` | `OtherTaxesDetails.aspx` |

Base URL: `https://www.greenvillecounty.org/appsas400/votaxqry/`

**Key finding**: Results pages are directly accessible via GET with query parameters. No ASP.NET viewstate, no session cookies required. The form POST to `Default.aspx` just 302-redirects to the results page with `SearchType` and `Criteria` in the query string.

---

## Search Flow

### The Hard Way (Browser Form POST)

```
1. GET  Default.aspx                              → Returns form with __VIEWSTATE
2. POST Default.aspx (form-urlencoded)             → 302 redirect
3. GET  VehicleTaxResults.aspx?SearchType=...      → HTML results
4. GET  VehicleTaxDetails.aspx?Year=...            → HTML detail
```

POST body fields:
- `__VIEWSTATE` (52 chars)
- `__VIEWSTATEGENERATOR` (8 chars)
- `__EVENTVALIDATION` (120 chars)
- `__EVENTTARGET` = `ctl00$bodyContent$lnk_Search`
- `ctl00$bodyContent$hdn_SearchCategory` = `Car` | `Real Estate` | `Other`
- Plus one search field (see below)

### The Easy Way (Direct GET)

Skip the form entirely. Results and detail pages are stateless GETs:

```
GET VehicleTaxResults.aspx?SearchType=Name&Criteria=SMITH+JOHN
GET VehicleTaxDetails.aspx?Year=2026&Month=1&Receipt=999999&Code=1&Suffix=1
GET OtherTaxesResults.aspx?SearchType=Name&Criteria=BROWN+LUKE
GET OtherTaxesDetails.aspx?Year=2016&Receipt=222916&Item=10&Suffix=1
```

No cookies, no viewstate, no auth required. Public endpoints.

---

## Search Fields by Category

### Vehicles (`hdn_SearchCategory=Car`)

| Field | Form Control | SearchType | Example Criteria |
|-------|-------------|------------|------------------|
| Account # | `txt_AccountNumber` | `AccountNumber` | `202601099999901001` (18-digit) |
| Name | `txt_Name` | `Name` | `SMITH JOHN` (Last First) |
| VIN # | `txt_VIN` | `VIN` | `1HGCG5655WA012345` |

Name is uppercased by server. Format: "Last First" or business name.

### Other (`hdn_SearchCategory=Other`)

| Field | Form Control | SearchType | Example |
|-------|-------------|------------|---------|
| Account # | `txt_AccountNumber` | `AccountNumber` | 18 or 13 digit |
| Name | `txt_Name` | `Name` | `BROWN ROBERT` (Last First) |
| SCDOR Reference ID | `txt_StateFileNumber` | `StateFileNumber` | `52307352` (8-digit) |
| County File # | `txt_CountyFileNumber` | `CountyFileNumber` | `05448` (5-digit) |
| Permit # | `txt_PermitNumber` | `PermitNumber` | `1234567` (7-digit) |
| Boat or Motor # | `txt_TitleNumber` | `TitleNumber` | `WAA232970` |

### Real Estate (`hdn_SearchCategory=Real Estate`)

| Field | Form Control | SearchType | Example |
|-------|-------------|------------|---------|
| Account # | `txt_AccountNumber` | `AccountNumber` | 18 or 13 digit |
| Name | `txt_Name` | `Name` | `DOE JOHN` |
| MAP # | `txt_MapNumber` | `MapNumber` | `1234567890123` (13-digit) |

Note: The Real Estate results page was not observed in the HAR and `RealEstateTaxResults.aspx` returns 404. This category may redirect to the existing `RealProperty/` system at `/appsAS400/RealProperty/Details.aspx`.

---

## Vehicle Tax Results

**URL**: `GET VehicleTaxResults.aspx?SearchType={type}&Criteria={value}`

**Response**: HTML page with `<table id="tbl_Results">`

### Table Columns

| Column | Content |
|--------|---------|
| Name | Owner name + VIN (e.g., `JONES WILLIAM HENRY VIN#: 2T1BU4EE5DC123456`) |
| Account # | Receipt number + vehicle year/make (e.g., `2026 01 0999999 01 001 2007 JAGU`) |
| Taxes | Amount + district (e.g., `$80.16 District: 195`) |
| Paid | Amount + date paid (e.g., `$43.12 06/17/2025`) or `$0` |
| Amount Due | Balance or blank |

### Detail Page Links

Unpaid rows show **"View Details"**, paid rows show **"View Receipt"**. Both link to:
```
VehicleTaxDetails.aspx?Year={Year}&Month={Month}&Receipt={Receipt}&Code={Code}&Suffix={Suffix}
```

The account number `2026 01 0999999 01 001` maps to query params:
- `Year` = `2026`
- `Month` = `1` (leading zero stripped)
- `Receipt` = `999999` (leading zero stripped from `0999999`)
- `Code` = `1`
- `Suffix` = `1`

### Result Count

Label `ctl00_bodyContent_lbl_SearchCriteria` shows search criteria. No explicit count label observed. No pagination — all results rendered on one page.

---

## Vehicle Tax Details

**URL**: `GET VehicleTaxDetails.aspx?Year={Year}&Month={Month}&Receipt={Receipt}&Code={Code}&Suffix={Suffix}`

**Response**: HTML page with labeled spans.

### ASP.NET Control IDs (prefix: `ctl00_bodyContent_`)

#### Basic Information
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_Name` | Name | `JONES WILLIAM HENRY` |
| `lbl_LevyYear` | Levy Year | `2025` |
| `lbl_Receipt` | Account # | `2026 01 0999999 01 001` |
| `lbl_Barcode` | Barcode | `*202601099999901001*` |

#### Vehicle Information
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_VehicleYear` | Year | `2007` |
| `lbl_VehicleMake` | Make | `JAGU` |
| `lbl_VehicleModel` | Model | `S-TYPE` |
| `lbl_VehicleBody` | Body | `SD` |
| `lbl_VehicleWeight` | Weight | `38` |
| `lbl_VehicleGrossWeight` | Gross Weight | `0` |
| `lbl_VINNumber` | VIN # | `2T1BU4EE5DC123456` |
| `lbl_District` | District | `195` |
| `lbl_ExpirationDate` | Exp Date | `1/31/2026` |
| `lbl_Assessment` | Assessment | `50` |
| `lbl_NumberOfMonths` | # Months | `12` |
| `lbl_NumberOfMiles` | # Miles | `0` |

#### Tax Summary
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_CountyMilage` | County Millage | `283.10` |
| `lbl_CityMilage` | City Millage | `0` |
| `lbl_TotalTaxes` | Total Taxes | `14.16` |
| `lbl_RoadFees` | Road Fee | `25.00` |
| `lbl_DMVRenewalFee` | DMV Decal Fee | `40.00` |
| `lbl_NSFFee` | NSF Fee | (blank) |
| `lbl_ProcessingFee` | Processing Fee | `1.00` |
| `lbl_HighMileCredit` | High Mile Credit | `0` |
| `lbl_TotalBilled` | Total Billed | `80.16` |
| `lbl_TotalPaid` | Total Paid | `0` |
| `lbl_BalanceDue` | Balance Due | `$80.16` |

#### Payment Status
| Control ID | Label |
|-----------|-------|
| `lbl_DatePaid` | Date Paid |
| `lbl_Status` | Status |

---

## Other Taxes Results

**URL**: `GET OtherTaxesResults.aspx?SearchType={type}&Criteria={value}`

**Response**: HTML page with `<table id="tbl_Results">`

### Table Columns

| Column | Content |
|--------|---------|
| Name | Owner name |
| Receipt Number | Linked to detail page (e.g., `2016 000222916 10 001`) |
| Location | Location code |
| Sid # | Schedule ID |
| Map # | Map number |
| Permit # | Permit number |
| Dist | District code |
| Exmt | Exempt flag |
| Delq | Delinquent flag |
| Assessment | Assessment value |
| Date Paid | Payment date |
| Base Amount | Base tax amount |
| Amount Paid | Amount paid |
| Balance Due | Remaining balance |

### Detail Page Links

Receipt numbers are hyperlinked:
```
OtherTaxesDetails.aspx?Year={Year}&Receipt={Receipt}&Item={Item}&Suffix={Suffix}
```

The `Item` parameter determines the property type (see Item Code table below).

---

## Other Taxes Details

**URL**: `GET OtherTaxesDetails.aspx?Year={Year}&Receipt={Receipt}&Item={Item}&Suffix={Suffix}`

**Response**: HTML page with labeled spans. The `Item` query parameter determines which detail section is shown and the page title.

### Item Codes (Property Types)

| Item Code | Property Type | Detail Table Shown |
|-----------|---------------|--------------------|
| `07` | Railroads & Pipelines | `tbl_SidSufx` |
| `08` | Business Furniture & Equipment | `tbl_SidSufx` |
| `10` | Boat | `tbl_YearTitleSer` |
| `11` | Aircraft | `tbl_YearTitleSer` |
| `12` | SC DOR - MFG Personal Property | `tbl_LotsAcresBuildings` |
| `13` | SC DOR - MFG | `tbl_LotsAcresBuildings` |
| `14` | Boat Motor | `tbl_YearTitleSer` |
| `15` | SC DOR - Furniture, Fixtures & Equipment | `tbl_SidSufx` |
| `16` | Personal Property Public Utility | (none) |
| `17` | Department of Revenue Penalty | `tbl_SidSufx` |
| `18` | Estimated Furniture/Fixtures | `tbl_SidSufx` |
| `30` | Boat | `tbl_YearTitleSer` |
| `32` | Boat Motor | `tbl_YearTitleSer` |
| `55` | Rollback Lien | `tbl_RollBack` |
| `65` | Mobile Homes 6% | `tbl_PermitYear` |
| `66` | Mobile Homes 4% | `tbl_PermitYear` |
| `70` | Fee in Lieu of Taxes | `tbl_SidSufx` |

### ASP.NET Control IDs (prefix: `ctl00_bodyContent_`)

#### General Information
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_Name` | Name | `BROWN ROBERT A` |
| `lbl_LevyYear` | Levy Year | `2016` |
| `lbl_ReceiptNumber` | Receipt Number | `2016 000222916 10 001` |
| `lbl_Address2` | Address | `302 TAYLORS RD` |
| `lbl_CityStateZip` | City/State/Zip | `TAYLORS SC 29687` |
| `lbl_District` | District | `276` |
| `lbl_Exempt` | Exempt | `No` |
| `lbl_Delq` | Delinquent | `Yes` |
| `lbl_MultiPark` | Multi Park | `0` |
| `lbl_Assessment` | Assessment | `110` |
| `lbl_Appraisal` | Appraisal | `1,050` |
| `lbl_CountyMill` | County Mill | `330.60` |
| `lbl_CityMill` | City Mill | `0` |

#### Detail: Year/Title/Serial (Boats, Aircraft, Boat Motors — Items 10, 11, 14, 30, 32)
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_YearTitleSer_Year` | Year | `2004` |
| `lbl_YearTitleSer_Make` | Make | `BOMBARDIER` |
| `lbl_YearTitleSer_Model` | Model | `6162` |
| `lbl_YearTitleSer_Title` | Title | `WAA0852294` |
| `lbl_YearTitleSer_SerialNumber` | Serial # | `ZZN46018C404` |
| `lbl_YearTitleSer_Length` | Length | `10.10` |

Additional fields visible in the detail section but without unique control IDs:
- Horse Power
- Category
- Schedule ID
- Account #
- SCDOR Reference ID
- Homestead Ind / Assm / Appr

#### Detail: SID/Sufx (Railroads, Business F&E, DOR F&F, Penalties, FILO — Items 07, 08, 15, 17, 18, 70)
Table `tbl_SidSufx` — fields not captured in this HAR session.

#### Detail: Permit Year (Mobile Homes — Items 65, 66)
Table `tbl_PermitYear` — fields not captured. Shows eBilling signup button.

#### Detail: Lots/Acres/Buildings (MFG Property — Items 12, 13)
Table `tbl_LotsAcresBuildings` — fields visible in HTML:
- Number Of Lots / Acres / Buildings
- Assessments / Appraisals for each
- Totals

#### Detail: Rollback (Item 55)
Table `tbl_RollBack` — fields not captured.

#### Tax Summary
| Control ID | Label | Example Value |
|-----------|-------|---------------|
| `lbl_TaxWOPen` | Tax w/o Penalty | `$36.37` |
| `lbl_TaxPlusThreePercent` | Tax + 3% Penalty | `$37.46` |
| `lbl_TaxPlusTenPercent` | Tax + 10% Penalty | `$40.00` |
| `lbl_TaxWithCostPlusFifteenPercent` | Tax + Cost + 15% | `$81.82` |
| `lbl_TotalTaxes` | Total Taxes | `$36.37` |
| `lbl_MiscCosts` | Misc-Costs | `$34.00` |
| `lbl_Advertise` | Advertise | `0` |
| `lbl_Sanitation` | Sanitation | `0` |
| `lbl_NSFFee` | NSF Fee | `0` |
| `lbl_TotalBilled` | Total Billed | `75.82` |
| `lbl_TotalPaid` | Total Paid | `75.82` |
| `lbl_BalanceDue` | Balance Due | `$0.00` |

#### Previous Payments
Panel `div_PreviousPayments` — shows historical payment records if applicable.

---

## Programmatic Access Pattern

No auth, no cookies, no viewstate needed for the results and detail pages.

### Search for Vehicle Tax Records by Name

```typescript
const url = 'https://www.greenvillecounty.org/appsas400/votaxqry/VehicleTaxResults.aspx'
  + '?SearchType=Name&Criteria=' + encodeURIComponent('SMITH JOHN');
const html = await fetch(url).then(r => r.text());
// Parse <table id="tbl_Results"> rows
// Extract VehicleTaxDetails links from <a> tags
```

### Search by VIN

```typescript
const url = 'https://www.greenvillecounty.org/appsas400/votaxqry/VehicleTaxResults.aspx'
  + '?SearchType=VIN&Criteria=' + encodeURIComponent('1HGCG5655WA012345');
```

### Search Other Taxes by Name

```typescript
const url = 'https://www.greenvillecounty.org/appsas400/votaxqry/OtherTaxesResults.aspx'
  + '?SearchType=Name&Criteria=' + encodeURIComponent('BROWN ROBERT');
```

### Get Vehicle Detail

```typescript
const url = 'https://www.greenvillecounty.org/appsas400/votaxqry/VehicleTaxDetails.aspx'
  + '?Year=2026&Month=1&Receipt=999999&Code=1&Suffix=1';
const html = await fetch(url).then(r => r.text());
// Parse spans by ID: ctl00_bodyContent_lbl_VehicleMake, etc.
```

### Get Other Tax Detail

```typescript
const url = 'https://www.greenvillecounty.org/appsas400/votaxqry/OtherTaxesDetails.aspx'
  + '?Year=2016&Receipt=222916&Item=10&Suffix=1';
// Item=10 → Boat, Item=14 → Boat Motor, Item=08 → Business F&E, etc.
```

---

## Name Format

Names are uppercased by the server. Input format: **Last First** (e.g., `smith john` → `SMITH JOHN`). Business names work directly (e.g., `B & B Toys Ind`). Partial names return prefix matches (e.g., `BROWN` returns all names starting with BROWN).

## Account Number Format

18-digit format: `YYYY MM RRRRRRR CC SSS` (Year, Month, Receipt, Code, Suffix)
- Example: `2026 01 0999999 01 001`
- 13-digit format also accepted

---

## Relationship to Existing Property Search

The `votaxqry` system is **separate** from the real property system (`/appsAS400/RealProperty/`). The real property system handles land/building tax assessments. `votaxqry` handles:
- Vehicle property taxes (annual registration-linked)
- Boat and boat motor taxes
- Business personal property (furniture, fixtures, equipment)
- Mobile home taxes
- Aircraft taxes
- Other specialized tax types (FILO, rollback liens, DOR penalties)

The "Real Estate" tab on the votaxqry search form likely redirects to the existing RealProperty system, but this was not captured in the HAR.
