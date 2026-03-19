import { describe, it, expect } from 'vitest'
import { parseHistoricalRecordsHtml } from '../../lib/parsers/historical-records'

// Realistic HTML fixtures based on actual ASP.NET DataGrid output

const ROOT_HTML = `
<table class="dirTable" id="dgItems" cellspacing="0" cellpadding="4" rules="all" border="1">
  <tr>
    <th scope="col">Name</th>
    <th scope="col">Size</th>
    <th scope="col">Last Updated</th>
  </tr>
  <tr>
    <td><a id="dgItems_ctl02_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl02$Linkbutton1','')">Council Commissioners</a></td>
    <td><span>1 Item(s)</span></td>
    <td><span>1/25/2007 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl03_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl03$Linkbutton1','')">Court of Common Pleas</a></td>
    <td><span>3 Item(s)</span></td>
    <td><span>4/5/2008 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl04_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl04$Linkbutton1','')">Probate Court</a></td>
    <td><span>9 Item(s)</span></td>
    <td><span>12/5/2006 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl05_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl05$Linkbutton1','')">Register of Deeds</a></td>
    <td><span>6 Item(s)</span></td>
    <td><span>3/15/2007 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl06_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl06$Linkbutton1','')">Sheriff's Office</a></td>
    <td><span>4 Item(s)</span></td>
    <td><span>6/20/2007 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td colspan="3"><span>5 Item(s) Found</span></td>
  </tr>
</table>`

const VOLUMES_HTML = `
<table class="dirTable" id="dgItems" cellspacing="0" cellpadding="4" rules="all" border="1">
  <tr>
    <th scope="col">Name</th>
    <th scope="col">Size</th>
    <th scope="col">Last Updated</th>
  </tr>
  <tr>
    <td><a id="dgItems_ctl02_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl02$Linkbutton1','')">Book A, 1800 - 1820</a></td>
    <td><span>150 Viewable Page(s)</span></td>
    <td><span>12/5/2006 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl03_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl03$Linkbutton1','')">Book B, 1820 - 1840</a></td>
    <td><span>298 Viewable Page(s)</span></td>
    <td><span>12/5/2006 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl04_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl04$Linkbutton1','')">Book D - E, 1853 - 1881</a></td>
    <td><span>620 Viewable Page(s)</span></td>
    <td><span>12/5/2006 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td colspan="3"><span>3 Item(s) Found</span></td>
  </tr>
</table>`

const MIXED_HTML = `
<table class="dirTable" id="dgItems" cellspacing="0" cellpadding="4" rules="all" border="1">
  <tr>
    <th scope="col">Name</th>
    <th scope="col">Size</th>
    <th scope="col">Last Updated</th>
  </tr>
  <tr>
    <td><a id="dgItems_ctl02_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl02$Linkbutton1','')">Subfolder With Items</a></td>
    <td><span>5 Item(s)</span></td>
    <td><span>1/1/2007 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td><a id="dgItems_ctl03_Linkbutton1" href="javascript:__doPostBack('dgItems$ctl03$Linkbutton1','')">Volume With Pages</a></td>
    <td><span>42 Viewable Page(s)</span></td>
    <td><span>2/2/2007 12:00:00 AM</span></td>
  </tr>
  <tr>
    <td colspan="3"><span>2 Item(s) Found</span></td>
  </tr>
</table>`

const EMPTY_HTML = `
<table class="dirTable" id="dgItems" cellspacing="0" cellpadding="4" rules="all" border="1">
  <tr>
    <th scope="col">Name</th>
    <th scope="col">Size</th>
    <th scope="col">Last Updated</th>
  </tr>
  <tr>
    <td colspan="3"><span>0 Item(s) Found</span></td>
  </tr>
</table>`

describe('parseHistoricalRecordsHtml', () => {
  it('parses root-level offices as folders', () => {
    const entries = parseHistoricalRecordsHtml(ROOT_HTML)
    expect(entries).toHaveLength(5)
    expect(entries[0]).toEqual({
      name: 'Council Commissioners',
      count: 1,
      lastUpdated: '1/25/2007 12:00:00 AM',
      type: 'folder',
    })
    expect(entries[2]).toEqual({
      name: 'Probate Court',
      count: 9,
      lastUpdated: '12/5/2006 12:00:00 AM',
      type: 'folder',
    })
    // All root entries are folders
    for (const entry of entries) {
      expect(entry.type).toBe('folder')
    }
  })

  it('parses leaf volumes with Viewable Page(s)', () => {
    const entries = parseHistoricalRecordsHtml(VOLUMES_HTML)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toEqual({
      name: 'Book A, 1800 - 1820',
      count: 150,
      lastUpdated: '12/5/2006 12:00:00 AM',
      type: 'volume',
    })
    expect(entries[1].name).toBe('Book B, 1820 - 1840')
    expect(entries[1].count).toBe(298)
    expect(entries[1].type).toBe('volume')
    // Handles special chars in volume names
    expect(entries[2].name).toBe('Book D - E, 1853 - 1881')
    expect(entries[2].count).toBe(620)
  })

  it('distinguishes folders from volumes in mixed listings', () => {
    const entries = parseHistoricalRecordsHtml(MIXED_HTML)
    expect(entries).toHaveLength(2)
    expect(entries[0].type).toBe('folder')
    expect(entries[0].name).toBe('Subfolder With Items')
    expect(entries[1].type).toBe('volume')
    expect(entries[1].name).toBe('Volume With Pages')
  })

  it('returns empty array for empty grid', () => {
    const entries = parseHistoricalRecordsHtml(EMPTY_HTML)
    expect(entries).toHaveLength(0)
  })

  it('skips footer row with "Found" text', () => {
    const entries = parseHistoricalRecordsHtml(ROOT_HTML)
    // Should not include "5 Item(s) Found" footer
    const footerEntry = entries.find(e => e.name.includes('Found'))
    expect(footerEntry).toBeUndefined()
  })

  it('handles apostrophes and special characters in names', () => {
    const html = `
    <table class="dirTable" id="dgItems">
      <tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
      <tr>
        <td><a href="javascript:void(0)">Sheriff's Office</a></td>
        <td><span>4 Item(s)</span></td>
        <td><span>6/20/2007 12:00:00 AM</span></td>
      </tr>
      <tr><td colspan="3"><span>1 Item(s) Found</span></td></tr>
    </table>`
    const entries = parseHistoricalRecordsHtml(html)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe("Sheriff's Office")
  })

  it('returns empty array for HTML without dgItems table', () => {
    const entries = parseHistoricalRecordsHtml('<html><body>No table here</body></html>')
    expect(entries).toHaveLength(0)
  })

  it('handles large volume counts (e.g., 242 estate records)', () => {
    const html = `
    <table class="dirTable" id="dgItems">
      <tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
      <tr>
        <td><a href="javascript:void(0)">Estate Records</a></td>
        <td><span>242 Item(s)</span></td>
        <td><span>12/5/2006 12:00:00 AM</span></td>
      </tr>
      <tr><td colspan="3"><span>1 Item(s) Found</span></td></tr>
    </table>`
    const entries = parseHistoricalRecordsHtml(html)
    expect(entries).toHaveLength(1)
    expect(entries[0].count).toBe(242)
    expect(entries[0].type).toBe('folder')
  })

  it('handles complex volume names with dates and ranges', () => {
    const html = `
    <table class="dirTable" id="dgItems">
      <tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
      <tr>
        <td><a href="javascript:void(0)">Apt 0001 File 001 - Apt 0002 File 082</a></td>
        <td><span>350 Viewable Page(s)</span></td>
        <td><span>1/1/2007 12:00:00 AM</span></td>
      </tr>
      <tr>
        <td><a href="javascript:void(0)">Book AAA 1893-1897 and 1901</a></td>
        <td><span>200 Viewable Page(s)</span></td>
        <td><span>2/2/2007 12:00:00 AM</span></td>
      </tr>
      <tr>
        <td><a href="javascript:void(0)">Book ZZ 1892-1897 &amp; 1899</a></td>
        <td><span>150 Viewable Page(s)</span></td>
        <td><span>3/3/2007 12:00:00 AM</span></td>
      </tr>
      <tr><td colspan="3"><span>3 Item(s) Found</span></td></tr>
    </table>`
    const entries = parseHistoricalRecordsHtml(html)
    expect(entries).toHaveLength(3)
    expect(entries[0].name).toBe('Apt 0001 File 001 - Apt 0002 File 082')
    expect(entries[0].type).toBe('volume')
    expect(entries[1].name).toBe('Book AAA 1893-1897 and 1901')
    expect(entries[2].name).toBe('Book ZZ 1892-1897 & 1899')
  })

  it('handles single viewable page count', () => {
    const html = `
    <table class="dirTable" id="dgItems">
      <tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
      <tr>
        <td><a href="javascript:void(0)">Single Page Doc</a></td>
        <td><span>1 Viewable Page(s)</span></td>
        <td><span>1/1/2007 12:00:00 AM</span></td>
      </tr>
      <tr><td colspan="3"><span>1 Item(s) Found</span></td></tr>
    </table>`
    const entries = parseHistoricalRecordsHtml(html)
    expect(entries).toHaveLength(1)
    expect(entries[0].count).toBe(1)
    expect(entries[0].type).toBe('volume')
  })

  it('handles single item folder count', () => {
    const html = `
    <table class="dirTable" id="dgItems">
      <tr><th>Name</th><th>Size</th><th>Last Updated</th></tr>
      <tr>
        <td><a href="javascript:void(0)">Account Books</a></td>
        <td><span>1 Item(s)</span></td>
        <td><span>1/1/2007 12:00:00 AM</span></td>
      </tr>
      <tr><td colspan="3"><span>1 Item(s) Found</span></td></tr>
    </table>`
    const entries = parseHistoricalRecordsHtml(html)
    expect(entries).toHaveLength(1)
    expect(entries[0].count).toBe(1)
    expect(entries[0].type).toBe('folder')
  })
})
