# Greenville County Unified Property Data API

## Overview

This document describes how to programmatically access and cross-reference property data from two Greenville County systems:

1. **GIS (Geographic Information System)** - Parcel maps, zoning, flood zones, tax data
2. **ROD (Register of Deeds)** - Deed documents, mortgages, plats, liens

**Cross-Reference Key:** The `CUBOOK`/`CUPAGE` (deed) and `PLTBK1`/`PPAGE1` (plat) fields from GIS link directly to searchable book/page references in ROD.

---

## GIS API (No Authentication Required)

**Base URL:** `https://www.gcgis.org/arcgis/rest/services/GreenvilleJS/`

### Key Map Services

| Service | URL | Description |
|---------|-----|-------------|
| Map Layers | `Map_Layers_JS/MapServer` | Parcels, zoning, addresses, districts |
| Base Map | `GVL_BaseMap_2025_JS/MapServer` | Aerial imagery tiles |
| Boundaries | `Boundary_JS/MapServer` | County, city boundaries |
| Labels | `Labels_JS/MapServer` | Street/place labels |
| Autocomplete | `AutoCompleteTop10/MapServer` | Search suggestions |

### Important Layer IDs (Map_Layers_JS)

| Layer ID | Name | Key Fields |
|----------|------|------------|
| 52 | Tax Parcel | Full parcel data with tax info |
| 53 | Tax Parcel In | Parcels inside incorporated areas |
| 51 | Subdivision | Subdivision/plat info |
| 68 | Zoning | Zoning designations |
| 64 | Flood Zone | FEMA flood zones |
| 35 | Site Address | Address points |
| 80 | Tax District | Tax district boundaries |
| 7-14 | Service Districts | Fire, water, sewer, schools |

### Coordinate System

**EPSG:6570** (NAD83(2011) / South Carolina)
- All queries use this spatial reference
- For web maps, transform to EPSG:4326 (WGS84)

---

## GIS Query Endpoints

### 1. Query by Owner Name

**Endpoint:** `GET /Map_Layers_JS/MapServer/52/query`

```
?f=json
&where=OWNAM1 LIKE 'SMITH%'
&returnGeometry=true
&outFields=*
&outSR=6570
```

**Example Response:**
```json
{
  "features": [{
    "attributes": {
      "PIN": "0544010100100",
      "OWNAM1": "SMITH JOHN DAVID (JTW",
      "OWNAM2": "SMITH JANE MARIE (JTWROS)",
      "STREET": "100 MAIN ST",
      "CITY": "TAYLORS",
      "STATE": "SC",
      "ZIP5": "29687",
      "CUBOOK": "2571",
      "CUPAGE": "5285",
      "PLTBK1": "1290",
      "PPAGE1": "93",
      "SUBDIV": "EAGLES GLEN AT KIMBRELL",
      "SLPRICE": 275000,
      "FAIRMKTVAL": 423220,
      "TAXMKTVAL": 307430,
      "TACRES": 0.18,
      "SQFEET": 2156,
      "BEDROOMS": 4,
      "BATHRMS": 2
    },
    "geometry": {
      "rings": [[[x1,y1], [x2,y2], ...]]
    }
  }]
}
```

### 2. Query by PIN (Tax Map Number)

```
?f=json
&where=PIN='0544010100100'
&returnGeometry=true
&outFields=*
&outSR=6570
```

### 3. Query by Address

```
?f=json
&where=STREET LIKE '%MAIN%' AND STRNUM=31
&returnGeometry=true
&outFields=*
&outSR=6570
```

### 4. Identify (Click on Map)

**Endpoint:** `GET /Map_Layers_JS/MapServer/identify`

```
?f=json
&geometry={"x":1609780,"y":1114398}
&geometryType=esriGeometryPoint
&sr=6570
&tolerance=10
&mapExtent=1609527,1114169,1609988,1114571
&imageDisplay=1107,963,96
&returnGeometry=false
&layers=all:52,53,68,64
```

Returns data from multiple layers at once.

### 5. Autocomplete Search

**Endpoint:** `GET /AutoCompleteTop10/MapServer/1/query`

```
?f=json
&where=Suggest LIKE 'SMITH%'
&returnGeometry=false
&outFields=Suggest,LayerField
```

**Response:**
```json
{
  "features": [
    {"attributes": {"Suggest": "SMITH JOHN DAVID", "LayerField": "Tax Parcel-OWNAM1"}},
    {"attributes": {"Suggest": "100 MAIN ST", "LayerField": "Site Address-ADDRESS"}}
  ]
}
```

### 6. Get Zoning for Parcel

**Endpoint:** `GET /Map_Layers_JS/MapServer/68/query`

```
?f=json
&geometry={"rings":[[[x1,y1],[x2,y2]...]]}
&geometryType=esriGeometryPolygon
&inSR=6570
&spatialRel=esriSpatialRelIntersects
&outFields=ZONING
```

---

## Parcel Data Fields (Layer 52/53)

| Field | Description | Example |
|-------|-------------|---------|
| PIN | Tax Map Number (13 digits) | 0544010100100 |
| OWNAM1 | Primary Owner | SMITH JOHN DAVID |
| OWNAM2 | Secondary Owner | SMITH JANE MARIE |
| STREET | Mailing Address | 100 MAIN ST |
| CITY | City | TAYLORS |
| STATE | State | SC |
| ZIP5 | ZIP Code | 29687 |
| POWNNM | Previous Owner | D R HORTON INC |
| DEEDDATE | Deed Date (Unix ms) | 1564444800000 |
| **CUBOOK** | **Current Deed Book** | **2571** |
| **CUPAGE** | **Current Deed Page** | **5285** |
| **PLTBK1** | **Plat Book** | **1290** |
| **PPAGE1** | **Plat Page** | **93** |
| DIST | Tax District | 276 |
| SUBDIV | Subdivision Name | EAGLES GLEN AT KIMBRELL |
| SLPRICE | Sale Price | 275000 |
| FAIRMKTVAL | Fair Market Value | 423220 |
| TAXMKTVAL | Tax Market Value | 307430 |
| TACRES | Total Acres | 0.18 |
| SQFEET | Building Sq Ft | 2156 |
| BEDROOMS | Bedrooms | 4 |
| BATHRMS | Bathrooms | 2 |
| LANDUSE | Land Use Code | 1100 |

---

## Cross-Reference: GIS → ROD

Once you have parcel data from GIS, use these fields to find documents in ROD:

| GIS Field | ROD Search Type | ROD Parameter |
|-----------|-----------------|---------------|
| CUBOOK + CUPAGE | Book/Page Search | VOLUME=DE, BOOK=2571, PAGE=5285 |
| PLTBK1 + PPAGE1 | Book/Page Search | VOLUME=PL, BOOK=1290, PAGE=93 |
| OWNAM1 | Name Search | ALLNAMES=SMITH+JOHN |
| PIN | Full Text Search | FTS1 (legal description contains PIN) |

### Example Workflow

```python
# 1. Search GIS for property by owner
gis_result = query_gis_by_owner("SMITH JOHN")

# 2. Extract cross-reference fields
deed_book = gis_result['CUBOOK']  # 2571
deed_page = gis_result['CUPAGE']  # 5285
plat_book = gis_result['PLTBK1']  # 1290
plat_page = gis_result['PPAGE1']  # 93

# 3. Search ROD for deed document
deed = rod.search_by_book_page("DE", deed_book, deed_page)

# 4. Search ROD for plat document
plat = rod.search_by_book_page("PL", plat_book, plat_page)

# 5. Download document images
rod.download_document(deed[0]['instId'], output_dir="./deeds")
rod.download_document(plat[0]['instId'], output_dir="./plats")
```

---

## Complete Python Client

```python
import requests
import json
import re
from bs4 import BeautifulSoup
from datetime import datetime
import os


class GreenvilleGIS:
    """Client for Greenville County GIS API"""
    
    BASE_URL = "https://www.gcgis.org/arcgis/rest/services/GreenvilleJS"
    
    def __init__(self):
        self.session = requests.Session()
    
    def query_parcels(self, where_clause, return_geometry=True):
        """Query tax parcels with SQL where clause"""
        params = {
            "f": "json",
            "where": where_clause,
            "returnGeometry": str(return_geometry).lower(),
            "outFields": "*",
            "outSR": "6570"
        }
        
        resp = self.session.get(
            f"{self.BASE_URL}/Map_Layers_JS/MapServer/52/query",
            params=params
        )
        
        data = resp.json()
        return data.get('features', [])
    
    def search_by_owner(self, name):
        """Search parcels by owner name"""
        # Clean name for SQL LIKE query
        name = name.upper().replace("'", "''")
        return self.query_parcels(f"OWNAM1 LIKE '{name}%'")
    
    def search_by_pin(self, pin):
        """Search parcel by PIN (Tax Map Number)"""
        return self.query_parcels(f"PIN = '{pin}'")
    
    def search_by_address(self, street, number=None):
        """Search parcels by street address"""
        street = street.upper().replace("'", "''")
        where = f"LOCATE LIKE '%{street}%'"
        if number:
            where += f" AND STRNUM = {number}"
        return self.query_parcels(where)
    
    def get_zoning(self, geometry):
        """Get zoning for a parcel geometry"""
        params = {
            "f": "json",
            "geometry": json.dumps({"rings": geometry['rings']}),
            "geometryType": "esriGeometryPolygon",
            "inSR": "6570",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "ZONING",
            "returnGeometry": "false"
        }
        
        resp = self.session.get(
            f"{self.BASE_URL}/Map_Layers_JS/MapServer/68/query",
            params=params
        )
        
        data = resp.json()
        features = data.get('features', [])
        if features:
            return features[0].get('attributes', {}).get('ZONING')
        return None
    
    def get_flood_zone(self, geometry):
        """Get FEMA flood zone for a parcel geometry"""
        params = {
            "f": "json",
            "geometry": json.dumps({"rings": geometry['rings']}),
            "geometryType": "esriGeometryPolygon",
            "inSR": "6570",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "FLD_ZONE",
            "returnGeometry": "false"
        }
        
        resp = self.session.get(
            f"{self.BASE_URL}/Map_Layers_JS/MapServer/64/query",
            params=params
        )
        
        data = resp.json()
        features = data.get('features', [])
        if features:
            return features[0].get('attributes', {}).get('FLD_ZONE')
        return "X (Not in flood zone)"
    
    def autocomplete(self, text):
        """Get autocomplete suggestions for search"""
        params = {
            "f": "json",
            "where": f"Suggest LIKE '{text.upper()}%'",
            "returnGeometry": "false",
            "outFields": "Suggest,LayerField"
        }
        
        resp = self.session.get(
            f"{self.BASE_URL}/AutoCompleteTop10/MapServer/1/query",
            params=params
        )
        
        data = resp.json()
        return [
            {
                "text": f['attributes']['Suggest'],
                "type": f['attributes']['LayerField']
            }
            for f in data.get('features', [])
        ]


class GreenvilleROD:
    """Client for Greenville County Register of Deeds"""
    
    BASE_URL = "https://viewer.greenvillecounty.org/countyweb"
    
    def __init__(self, username, password):
        self.session = requests.Session()
        self.username = username
        self.password = password
        self.jsessionid = None
        self._login()
    
    def _login(self):
        """Complete login flow"""
        # Get token
        login_page = self.session.get(
            f"{self.BASE_URL}/loginDisplay.action",
            params={"countyname": "Greenville"}
        )
        
        token_match = re.search(
            r'name=["\']token["\'][^>]*value=["\']([^"\']+)["\']',
            login_page.text
        )
        if not token_match:
            token_match = re.search(r'value=["\']([A-Z0-9]{32})["\']', login_page.text)
        
        token = token_match.group(1) if token_match else ""
        
        # Login
        login_data = {
            "cmd": "login",
            "countyname": "Greenville",
            "scriptsupport": "yes",
            "CountyFusionForceNewSession": "true",
            "struts.token.name": "token",
            "token": token,
            "username": self.username,
            "password": self.password
        }
        
        self.session.post(f"{self.BASE_URL}/login.action", data=login_data)
        
        if 'JSESSIONID' in self.session.cookies:
            self.jsessionid = self.session.cookies['JSESSIONID']
        
        # Accept disclaimer
        self.session.post(f"{self.BASE_URL}/disclaimer.do", data={"cmd": "Accept"})
        self.session.post(f"{self.BASE_URL}/user/setEnhancedUI.do", data={"enhancedUI": "true"})
    
    def search_by_book_page(self, volume, book, page):
        """
        Search by book and page.
        volume: 'DE' (Deed), 'MT' (Mortgage), 'PL' (Plat)
        """
        params = {
            "searchCategory": "ADVANCED",
            "searchSessionId": "searchJobMain",
            "SEARCHTYPE": "bookPage",
            "RECSPERPAGE": "100",
            "INSTTYPEALL": "selected",
            "VOLUME": volume,
            "BOOK": str(book),
            "PAGE": str(page),
            "PAGEEND": str(page)
        }
        
        self.session.post(f"{self.BASE_URL}/search/searchExecute.do?assessor=false", data=params)
        
        resp = self.session.get(
            f"{self.BASE_URL}/search/Greenville/docs_SearchResultList.jsp",
            params={"scrollPos": 0, "searchSessionId": "searchJobMain"}
        )
        
        return self._parse_results(resp.text)
    
    def search_by_name(self, name):
        """Search by grantor/grantee name"""
        params = {
            "searchCategory": "ADVANCED",
            "searchSessionId": "searchJobMain",
            "SEARCHTYPE": "allNames",
            "RECSPERPAGE": "100",
            "INSTTYPEALL": "true",
            "PARTY": "both",
            "ALLNAMES": name.replace(" ", "+")
        }
        
        self.session.post(f"{self.BASE_URL}/search/searchExecute.do?assessor=false", data=params)
        
        resp = self.session.get(
            f"{self.BASE_URL}/search/Greenville/docs_SearchResultList.jsp",
            params={"scrollPos": 0, "searchSessionId": "searchJobMain"}
        )
        
        return self._parse_results(resp.text)
    
    def _parse_results(self, html):
        """Parse search results HTML"""
        results = []
        
        pattern = r"documentRowInfo\[(\d+)\]\.(\w+)\s*=\s*[\"']?([^\"';]+)[\"']?"
        matches = re.findall(pattern, html)
        
        current = {}
        current_idx = None
        
        for idx, prop, value in matches:
            if idx != current_idx:
                if current:
                    results.append(current)
                current = {}
                current_idx = idx
            current[prop] = value.strip()
        
        if current:
            results.append(current)
        
        # Parse table for additional fields
        soup = BeautifulSoup(html, 'html.parser')
        rows = soup.find_all('tr', id=re.compile(r'^\d+$'))
        
        for i, row in enumerate(rows):
            if i < len(results):
                tds = row.find_all('td')
                if len(tds) >= 12:
                    results[i]['book'] = tds[3].get_text(strip=True)
                    results[i]['page'] = tds[4].get_text(strip=True)
                    results[i]['recordDate'] = tds[5].get_text(strip=True)
                    results[i]['instTypeDesc'] = tds[6].get_text(strip=True)
                    results[i]['name'] = tds[8].get_text(strip=True)
                    results[i]['otherName'] = tds[10].get_text(strip=True)
                    results[i]['legalDesc'] = tds[11].get_text(strip=True)
        
        return results
    
    def get_document_image(self, inst_id, page_number=1):
        """Download document page as PNG"""
        import time
        
        self.session.get(
            f"{self.BASE_URL}/imageViewer/getPage.do",
            params={
                "addWatermarks": "false",
                "isPreview": "false",
                "instnum": inst_id,
                "pageNumber": page_number
            }
        )
        
        ver = int(time.time() * 1000000)
        img_url = f"{self.BASE_URL}/viewImagePNG.do?ver={ver}&instnum={inst_id}&isPreview=false&;jsessionid={self.jsessionid}"
        
        resp = self.session.get(img_url)
        
        if resp.status_code == 200:
            return resp.content
        return None
    
    def download_document(self, inst_id, output_dir=".", inst_num=None):
        """Download all pages of a document"""
        os.makedirs(output_dir, exist_ok=True)
        
        files = []
        page = 1
        
        while page < 100:  # Safety limit
            img_data = self.get_document_image(inst_id, page)
            
            if not img_data or len(img_data) < 1000:
                break
            
            filename = f"{inst_num or inst_id}_page{page:03d}.png"
            filepath = os.path.join(output_dir, filename)
            
            with open(filepath, 'wb') as f:
                f.write(img_data)
            
            files.append(filepath)
            page += 1
        
        return files


class GreenvilleProperty:
    """Unified property lookup combining GIS and ROD"""
    
    def __init__(self, rod_username=None, rod_password=None):
        self.gis = GreenvilleGIS()
        self.rod = None
        if rod_username and rod_password:
            self.rod = GreenvilleROD(rod_username, rod_password)
    
    def lookup_by_owner(self, name):
        """Complete property lookup by owner name"""
        results = []
        
        # Get parcels from GIS
        parcels = self.gis.search_by_owner(name)
        
        for parcel in parcels:
            attrs = parcel.get('attributes', {})
            geom = parcel.get('geometry')
            
            # Build property record
            prop = {
                "pin": attrs.get('PIN'),
                "owner1": attrs.get('OWNAM1'),
                "owner2": attrs.get('OWNAM2'),
                "address": f"{attrs.get('STRNUM', '')} {attrs.get('LOCATE', '')}".strip(),
                "city": attrs.get('CITY'),
                "state": attrs.get('STATE'),
                "zip": attrs.get('ZIP5'),
                "subdivision": attrs.get('SUBDIV'),
                "sale_price": attrs.get('SLPRICE'),
                "fair_market_value": attrs.get('FAIRMKTVAL'),
                "tax_value": attrs.get('TAXMKTVAL'),
                "acres": attrs.get('TACRES'),
                "sqft": attrs.get('SQFEET'),
                "bedrooms": attrs.get('BEDROOMS'),
                "bathrooms": attrs.get('BATHRMS'),
                "deed_book": attrs.get('CUBOOK'),
                "deed_page": attrs.get('CUPAGE'),
                "plat_book": attrs.get('PLTBK1'),
                "plat_page": attrs.get('PPAGE1'),
                "geometry": geom
            }
            
            # Get zoning if geometry available
            if geom:
                prop["zoning"] = self.gis.get_zoning(geom)
                prop["flood_zone"] = self.gis.get_flood_zone(geom)
            
            # Get ROD documents if authenticated
            if self.rod and prop['deed_book'] and prop['deed_page']:
                try:
                    deed_results = self.rod.search_by_book_page(
                        "DE", prop['deed_book'], prop['deed_page']
                    )
                    prop["deed_documents"] = deed_results
                except:
                    pass
            
            results.append(prop)
        
        return results
    
    def lookup_by_address(self, street, number=None):
        """Complete property lookup by address"""
        parcels = self.gis.search_by_address(street, number)
        
        results = []
        for parcel in parcels:
            attrs = parcel.get('attributes', {})
            results.append({
                "pin": attrs.get('PIN'),
                "owner": attrs.get('OWNAM1'),
                "address": f"{attrs.get('STRNUM', '')} {attrs.get('LOCATE', '')}".strip(),
                "deed_book": attrs.get('CUBOOK'),
                "deed_page": attrs.get('CUPAGE')
            })
        
        return results


# Example Usage
if __name__ == "__main__":
    # GIS only (no authentication needed)
    gis = GreenvilleGIS()
    
    print("=== GIS Search by Owner ===")
    parcels = gis.search_by_owner("SMITH JOHN")
    for p in parcels[:3]:
        attrs = p['attributes']
        print(f"PIN: {attrs['PIN']}")
        print(f"Address: {attrs['STRNUM']} {attrs['LOCATE']}, {attrs['CITY']}")
        print(f"Deed: Book {attrs['CUBOOK']} Page {attrs['CUPAGE']}")
        print(f"Plat: Book {attrs['PLTBK1']} Page {attrs['PPAGE1']}")
        print()
    
    # Full lookup with ROD (requires credentials)
    # prop = GreenvilleProperty(rod_username="user", rod_password="pass")
    # results = prop.lookup_by_owner("SMITH JOHN")
    # for r in results:
    #     print(f"{r['address']} - Deed Book {r['deed_book']}")
```

---

## API Quick Reference

### GIS (No Auth)

| Action | Endpoint | Key Params |
|--------|----------|------------|
| Search by owner | `/Map_Layers_JS/MapServer/52/query` | `where=OWNAM1 LIKE 'NAME%'` |
| Search by PIN | `/Map_Layers_JS/MapServer/52/query` | `where=PIN='0544010100100'` |
| Get zoning | `/Map_Layers_JS/MapServer/68/query` | `geometry={polygon}` |
| Get flood zone | `/Map_Layers_JS/MapServer/64/query` | `geometry={polygon}` |
| Autocomplete | `/AutoCompleteTop10/MapServer/1/query` | `where=Suggest LIKE 'TEXT%'` |

### ROD (Auth Required)

| Action | Endpoint | Key Params |
|--------|----------|------------|
| Login | `POST /login.action` | `username`, `password`, `token` |
| Search by name | `POST /search/searchExecute.do` | `SEARCHTYPE=allNames`, `ALLNAMES=` |
| Search by book/page | `POST /search/searchExecute.do` | `SEARCHTYPE=bookPage`, `VOLUME=`, `BOOK=`, `PAGE=` |
| Get doc image | `GET /viewImagePNG.do` | `instnum=`, `jsessionid=` |

---

## Rate Limiting & Best Practices

1. **GIS API** - No known rate limits, but be respectful (1-2 requests/second)
2. **ROD API** - Session-based; maintain one session per user
3. **Caching** - Cache GIS responses (parcel data changes infrequently)
4. **Document Downloads** - Download during off-peak hours when possible

---

## Version History

- **2026-01-23:** Initial unified documentation
- Sources: GIS HAR capture + ROD HAR capture analysis
