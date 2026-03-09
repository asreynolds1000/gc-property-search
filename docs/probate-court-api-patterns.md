# Greenville County Probate Court — Marriage License Search API Patterns

Extracted from HAR capture + live endpoint testing, 2026-03-08.

## Overview

- **Base URL**: `https://www.greenvillecounty.org/apps/MLSearch/`
- **Auth**: None required (fully public). Incapsula WAF sets tracking cookies but they are not needed for requests.
- **Technology**: ASP.NET Web Forms (ViewState, postback model)
- **Key insight**: The results page (`SearchResults.aspx`) works via direct GET with query parameters — no need to POST through the search form or manage ASP.NET ViewState.

## Pages

| Page | Purpose |
|------|---------|
| `Default.aspx` | Search form (GET to load, POST to search) |
| `SearchResults.aspx` | Results display (GET with query params) |
| `../../disclaimer/PublicRecords.aspx?DirURL=MLSearch` | Public records disclaimer gate |
| `https://greenvillecounty.org/apps/MarriageLicenseRequest/Default.aspx` | Certified copy request form (separate app) |

## Search Form (`Default.aspx`)

### Form Fields

| Field Name (ASP.NET) | ID | Label | Format | Notes |
|---|---|---|---|---|
| `ctl00$PageContent$txt_BrideName` | `PageContent_txt_BrideName` | Applicant Name | `Last First Middle` | Primary search field |
| `ctl00$PageContent$txt_GroomName` | `PageContent_txt_GroomName` | Applicant 2 Name | `Last First Middle` | Hidden (`display: none`) in current UI |
| `ctl00$PageContent$txt_LicenseYear` | `PageContent_txt_LicenseYear` | License Year | `YYYY` (maxlength=4) | Optional, narrows results |

### Search Trigger

The search button is an ASP.NET LinkButton, not a regular submit:
```
<a onclick="DoSearch();" id="PageContent_lnk_Search"
   href="javascript:__doPostBack('ctl00$PageContent$lnk_Search','')">Search</a>
```

`DoSearch()` just shows a "Searching..." spinner — the actual submission is via `__doPostBack`.

### POST Request

```
POST /apps/MLSearch/Default.aspx
Content-Type: application/x-www-form-urlencoded

__EVENTTARGET=ctl00%24PageContent%24lnk_Search
__EVENTARGUMENT=
__VIEWSTATE=[present]
__VIEWSTATEGENERATOR=[present, 8 chars, e.g. "46D7F95C"]
__EVENTVALIDATION=[present]
ctl00%24PageContent%24txt_BrideName=smith+john
ctl00%24PageContent%24txt_GroomName=
ctl00%24PageContent%24txt_LicenseYear=
```

### POST Response

**302 redirect** to `SearchResults.aspx` with the name parsed into separate query params:

```
Location: /apps/MLSearch/SearchResults.aspx?LastName2=&FirstName2=&MiddleName2=&LastName1=smith&FirstName1=john&MiddleName1=&Year=
```

The server splits the single `txt_BrideName` value (`"smith john"`) into:
- First token → `LastName1`
- Second token → `FirstName1`
- Third token → `MiddleName1`

Same split for `txt_GroomName` → `LastName2`, `FirstName2`, `MiddleName2`.

## Results Page (`SearchResults.aspx`) — Direct GET

**This is the primary endpoint for programmatic access.** No POST, ViewState, or cookies needed.

### URL Pattern

```
GET /apps/MLSearch/SearchResults.aspx?LastName2={}&FirstName2={}&MiddleName2={}&LastName1={}&FirstName1={}&MiddleName1={}&Year={}
```

### Query Parameters

| Param | Required | Description |
|-------|----------|-------------|
| `LastName1` | No* | Applicant 1 last name |
| `FirstName1` | No | Applicant 1 first name |
| `MiddleName1` | No | Applicant 1 middle name |
| `LastName2` | No* | Applicant 2 last name |
| `FirstName2` | No | Applicant 2 first name |
| `MiddleName2` | No | Applicant 2 middle name |
| `Year` | No | License year (YYYY) |

*At least one name or year should be provided for meaningful results.

All params should be present in the URL (pass empty string if not used). The search uses AND logic across provided fields.

### Search Behavior

- **Last name**: Matches as a prefix/contains — `smith` matches `Smith`, `Smith Harrison`, `Smithson`
- **First name**: Appears to require exact match — `john` for LastName1=`smith` returns 0 rows, while LastName1=`smith` alone returns many
- **Year**: Filters to licenses issued in that calendar year
- **Both applicants**: AND logic (both must match)
- **Max results**: 500 rows returned, then shows "Over 500 records found, please refine search for better results"
- **No pagination**: All results on a single page

### Response HTML Structure

#### Result Count
```html
<span id="PageContent_lbl_ResultCount">
  <font color="#1C436C">2 results found</font>
</span>
```

For overflow:
```html
<font color="#1C436C">Over 500 records found, please refine search for better results</font>
```

For no results:
```html
<font color="#1C436C">0 results found</font>
```

#### Results Table

```html
<table class="SearchResults" style="margin: 0 auto;">
  <tr>
    <th>License</th>
    <th><span id="PageContent_lbl_Bride">Applicant 1</span> Name</th>
    <th><span id="PageContent_lbl_Groom">Applicant 2</span> Name</th>
    <th>Date Married</th>
    <th>&nbsp;</th>
    <th>&nbsp;</th>
  </tr>
  <!-- Rows alternate: background: #ddd / background-color: #efefef -->
  <tr style="background: #ddd;">
    <td style="text-align: center;">2020-9999</td>
    <td>Smith, John David</td>
    <td>Doe, Jane Marie</td>
    <td style="text-align: center;">03/15/2020</td>
    <td><!-- Opt-Out button --></td>
    <td><!-- Request Copy button --></td>
  </tr>
</table>
```

#### Data Fields Per Row

| Column | Format | Notes |
|--------|--------|-------|
| License | `YYYY-NNNN` (e.g., `2020-9999`, `1960-865`) | Year + sequence number, variable length |
| Applicant 1 Name | `Last, First Middle` | Full name with maiden names |
| Applicant 2 Name | `Last, First Middle` | Full name |
| Date Married | `MM/DD/YYYY` | May be **empty** if license issued but no marriage date recorded |

#### Action Buttons (ASP.NET Postback)

Each row has two postback buttons — these require ViewState and cannot be called via simple GET:

```html
<!-- Opt-Out (removes from Internet listing) -->
<a id="PageContent_rpt_Results_lnk_OptOut_0" class="greenMini"
   href="javascript:__doPostBack('ctl00$PageContent$rpt_Results$ctl00$lnk_OptOut','')">Opt-Out</a>

<!-- Request Copy (initiates certified copy request) -->
<a id="PageContent_rpt_Results_LinkButton2_0" class="greenMini"
   href="javascript:__doPostBack('ctl00$PageContent$rpt_Results$ctl00$LinkButton2','')">Request Copy</a>
```

The row index increments: `ctl00`, `ctl01`, `ctl02`, etc. Button IDs also increment: `lnk_OptOut_0`, `lnk_OptOut_1` / `LinkButton2_0`, `LinkButton2_1`.

**Note**: The Opt-Out and Request Copy button IDs are inconsistent — first row uses `lnk_OptOut` and `LinkButton2`, subsequent rows use `LinkButton1` and `LinkButton3`. This is an ASP.NET Repeater quirk.

## ASP.NET Controls

| Control | Type | Purpose |
|---------|------|---------|
| `PageContent` | ContentPlaceHolder | Main content area |
| `rpt_Results` | Repeater | Results row generator |
| `lbl_ResultCount` | Label | "N results found" message |
| `lbl_Bride` / `lbl_Groom` | Label | Column header text ("Applicant 1"/"Applicant 2") |
| `lnk_Search` | LinkButton | Search trigger (postback) |

## Certified Copy Request Form (Separate App)

URL: `https://www.greenvillecounty.org/apps/MarriageLicenseRequest/Default.aspx`

When "Request Copy" is clicked from results, the request form is pre-populated with:

| Field | ASP.NET Name | Purpose |
|-------|---|---|
| Marriage License ID | `hdn_MarriageLicenseID` | Hidden, internal ID |
| License Number | `hdn_LicesneNumber` | Hidden (note: typo "Licesne" in actual field name) |
| Applicant 1 | `txt_Applicant1` | Pre-filled name |
| Applicant 2 | `txt_Applicant2` | Pre-filled name |
| Marriage Year | `txt_MarriageYear` | Pre-filled year |
| Mailing Name | `txt_MailingName` | Requestor's name |
| Street Address | `txt_StreetAddress` | Mailing address |
| City | `txt_City` | City |
| Zip Code | `txt_ZipCode` | Zip |
| Email | `txt_Email` | Contact email |

### Fee Schedule (from search page)

- Records 1911–1970: $6.00/copy
- Records 1971–present: $5.50/copy
- No-record searches: $7.00 research fee
- Processing fee: $1.50 (GovPayNet)

## Programmatic Access Pattern

The simplest approach is direct GET to SearchResults.aspx:

```typescript
const baseUrl = 'https://www.greenvillecounty.org/apps/MLSearch/SearchResults.aspx';

async function searchMarriageLicenses(params: {
  lastName1?: string;
  firstName1?: string;
  middleName1?: string;
  lastName2?: string;
  firstName2?: string;
  middleName2?: string;
  year?: string;
}) {
  const searchParams = new URLSearchParams({
    LastName1: params.lastName1 || '',
    FirstName1: params.firstName1 || '',
    MiddleName1: params.middleName1 || '',
    LastName2: params.lastName2 || '',
    FirstName2: params.firstName2 || '',
    MiddleName2: params.middleName2 || '',
    Year: params.year || '',
  });

  const response = await fetch(`${baseUrl}?${searchParams}`);
  const html = await response.text();
  return parseMarriageResults(html);
}
```

### Parsing Strategy

1. **Result count**: Extract from `#PageContent_lbl_ResultCount` — text is `"N results found"` or `"Over 500 records..."`
2. **Results table**: Select `table.SearchResults` rows (skip header `<tr>` with `<th>` elements)
3. **Row data**: 6 `<td>` cells per row — License, Applicant 1, Applicant 2, Date Married, Opt-Out button, Request Copy button
4. **Empty dates**: The Date Married field may be empty string (license issued, marriage not yet recorded)

### Example Parse

```typescript
// Regex approach (no DOM parser needed)
const countMatch = html.match(/lbl_ResultCount[^>]*><font[^>]*>([^<]+)/);
const resultCount = countMatch ? countMatch[1] : 'unknown';

const rowRegex = /<tr style="background[^"]*">\s*<td[^>]*>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>/gs;
const results = [];
let match;
while ((match = rowRegex.exec(html)) !== null) {
  results.push({
    licenseNumber: match[1].trim(),
    applicant1: match[2].trim(),
    applicant2: match[3].trim(),
    dateMarried: match[4].trim() || null,
  });
}
```

## Notes

- The `Applicant 2 Name` field is hidden (`display: none`) on the current search form, but the `LastName2`/`FirstName2`/`MiddleName2` query params work on the results page. This means you can search by Applicant 2 directly via GET.
- License numbers span from at least 1954 to present in the database.
- Names are stored as `"Last, First Middle"` with maiden names. Some entries have extra spaces (e.g., `"Smith , Robert Lee"`).
- The "Opt-Out" feature removes a record from the Internet listing — opted-out records will not appear in search results.
- No detail page exists — the results table shows all available fields. The only drill-down is the Request Copy form.
