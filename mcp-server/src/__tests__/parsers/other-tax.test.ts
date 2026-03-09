import { describe, it, expect } from 'vitest'
import { parseOtherTaxResultsHtml, parseOtherTaxDetailHtml } from '../../lib/parsers/other-tax.js'

describe('parseOtherTaxResultsHtml', () => {
  it('parses rows from grouped 7-column table', () => {
    const html = `
      <table id="tbl_Results" class="DataTable">
        <thead><tr><th>Name</th></tr></thead>
        <tbody>
          <tr>
            <td valign="top" align="left">
              <span style="font-weight:bold;">BROWN ROBERT A</span>
              <div><a href='OtherTaxesDetails.aspx?Year=2016&Receipt=222916&Item=10&Suffix=1'>2016&nbsp;000222916&nbsp;10&nbsp;001</a></div>
            </td>
            <td valign="top" align="left">
              <div>&nbsp;</div>
              <div>&nbsp;</div>
              <div>&nbsp;</div>
            </td>
            <td valign="top">
              <div>&nbsp;</div>
              <div>276&nbsp;</div>
            </td>
            <td valign="top">
              <div>&nbsp;</div>
              <div>D&nbsp;</div>
            </td>
            <td valign="top" align="right">
              <div>110&nbsp;</div>
              <div>06/13/2017&nbsp;</div>
            </td>
            <td valign="top" align="right">
              <div>$36.37</div>
              <div>75.82</div>
            </td>
            <td valign="middle" align="center">
              <div style="color: Red;"><span style="font-weight:bold;"></span>&nbsp;</div>
            </td>
          </tr>
          <tr class="odd">
            <td valign="top" align="left">
              <span style="font-weight:bold;">BROWN ROBERT A</span>
              <div><a href='OtherTaxesDetails.aspx?Year=2017&amp;Receipt=223686&amp;Item=10&amp;Suffix=1'>2017&nbsp;000223686&nbsp;10&nbsp;001</a></div>
            </td>
            <td valign="top" align="left">
              <div>&nbsp;</div>
              <div>12345&nbsp;</div>
              <div>&nbsp;</div>
            </td>
            <td valign="top">
              <div>&nbsp;</div>
              <div>276&nbsp;</div>
            </td>
            <td valign="top">
              <div>No&nbsp;</div>
              <div>&nbsp;</div>
            </td>
            <td valign="top" align="right">
              <div>200&nbsp;</div>
              <div>&nbsp;</div>
            </td>
            <td valign="top" align="right">
              <div>$66.12</div>
              <div>0</div>
            </td>
            <td valign="middle" align="center">
              <div>$66.12</div>
            </td>
          </tr>
        </tbody>
      </table>
    `
    const results = parseOtherTaxResultsHtml(html)
    expect(results).toHaveLength(2)

    expect(results[0].name).toBe('BROWN ROBERT A')
    expect(results[0].receiptNumber).toBe('2016 000222916 10 001')
    expect(results[0].district).toBe('276')
    expect(results[0].delinquent).toBe('D')
    expect(results[0].assessment).toBe('110')
    expect(results[0].datePaid).toBe('06/13/2017')
    expect(results[0].baseAmount).toBe('$36.37')
    expect(results[0].detailParams).toEqual({
      year: '2016', receipt: '222916', item: '10', suffix: '1',
    })

    // Second row uses &amp; in href
    expect(results[1].detailParams).toEqual({
      year: '2017', receipt: '223686', item: '10', suffix: '1',
    })
    expect(results[1].scheduleId).toBe('12345')
    expect(results[1].balanceDue).toBe('$66.12')
  })

  it('returns empty array when no tbody', () => {
    const html = '<html><body>No records found</body></html>'
    expect(parseOtherTaxResultsHtml(html)).toEqual([])
  })

  it('returns empty array when tbody has no data rows', () => {
    const html = `
      <table id="tbl_Results">
        <thead><tr><th>Name</th></tr></thead>
        <tbody></tbody>
      </table>
    `
    expect(parseOtherTaxResultsHtml(html)).toEqual([])
  })
})

describe('parseOtherTaxDetailHtml', () => {
  it('parses boat detail (item 10) with year/make/model', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">BROWN ROBERT A</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2016</span>
      <span id="ctl00_bodyContent_lbl_ReceiptNumber">2016 000222916 10 001</span>
      <span id="ctl00_bodyContent_lbl_Address2">302 TAYLORS RD</span>
      <span id="ctl00_bodyContent_lbl_CityStateZip">TAYLORS SC 29687</span>
      <span id="ctl00_bodyContent_lbl_District">276</span>
      <span id="ctl00_bodyContent_lbl_Exempt">No</span>
      <span id="ctl00_bodyContent_lbl_Delq">Yes</span>
      <span id="ctl00_bodyContent_lbl_Assessment">110</span>
      <span id="ctl00_bodyContent_lbl_Appraisal">1,050</span>
      <span id="ctl00_bodyContent_lbl_CountyMill">330.60</span>
      <span id="ctl00_bodyContent_lbl_CityMill">0</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_Year">2004</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_Make">BOMBARDIER</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_Model">6162</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_Title">WAA0852294</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_SerialNumber">ZZN46018C404</span>
      <span id="ctl00_bodyContent_lbl_YearTitleSer_Length">10.10</span>
      <span id="ctl00_bodyContent_lbl_TaxWOPen">$36.37</span>
      <span id="ctl00_bodyContent_lbl_TotalTaxes">$36.37</span>
      <span id="ctl00_bodyContent_lbl_TotalBilled">75.82</span>
      <span id="ctl00_bodyContent_lbl_TotalPaid">75.82</span>
      <span id="ctl00_bodyContent_lbl_BalanceDue">$0.00</span>
    `
    const detail = parseOtherTaxDetailHtml(html, '10')

    expect(detail.name).toBe('BROWN ROBERT A')
    expect(detail.propertyType).toBe('Boat')
    expect(detail.itemCode).toBe('10')
    expect(detail.address).toBe('302 TAYLORS RD')
    expect(detail.assessment).toBe('110')
    expect(detail.yearMakeModel).toEqual({
      year: '2004',
      make: 'BOMBARDIER',
      model: '6162',
      title: 'WAA0852294',
      serialNumber: 'ZZN46018C404',
      length: '10.10',
    })
    expect(detail.totalBilled).toBe('75.82')
    expect(detail.balanceDue).toBe('$0.00')
  })

  it('parses business F&E detail (item 08) without year/make/model', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">ACME CORP</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2025</span>
      <span id="ctl00_bodyContent_lbl_ReceiptNumber">2025 000333333 08 001</span>
      <span id="ctl00_bodyContent_lbl_District">100</span>
      <span id="ctl00_bodyContent_lbl_Assessment">500</span>
      <span id="ctl00_bodyContent_lbl_TotalBilled">150.00</span>
      <span id="ctl00_bodyContent_lbl_TotalPaid">150.00</span>
      <span id="ctl00_bodyContent_lbl_BalanceDue">$0.00</span>
    `
    const detail = parseOtherTaxDetailHtml(html, '08')

    expect(detail.name).toBe('ACME CORP')
    expect(detail.propertyType).toBe('Business Furniture & Equipment')
    expect(detail.yearMakeModel).toBeUndefined()
    expect(detail.totalBilled).toBe('150.00')
  })

  it('handles missing optional fields gracefully', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">UNKNOWN</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2025</span>
      <span id="ctl00_bodyContent_lbl_ReceiptNumber">2025 000444444 65 001</span>
    `
    const detail = parseOtherTaxDetailHtml(html, '65')

    expect(detail.name).toBe('UNKNOWN')
    expect(detail.propertyType).toBe('Mobile Homes 6%')
    expect(detail.address).toBeUndefined()
    expect(detail.totalBilled).toBeUndefined()
    expect(detail.yearMakeModel).toBeUndefined()
  })

  it('maps unknown item code correctly', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">TEST</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2025</span>
      <span id="ctl00_bodyContent_lbl_ReceiptNumber">2025 000555555 99 001</span>
    `
    const detail = parseOtherTaxDetailHtml(html, '99')
    expect(detail.propertyType).toBe('Unknown (99)')
  })
})
