import { describe, it, expect } from 'vitest'
import { parseVehicleTaxResultsHtml, parseVehicleTaxDetailHtml } from '../../lib/parsers/vehicle-tax.js'

describe('parseVehicleTaxResultsHtml', () => {
  it('parses multiple result rows with &amp; in links', () => {
    const html = `
      <table id="tbl_Results">
        <tr><th>Name</th><th>Account #</th><th>Taxes</th><th>Paid</th><th>Amount Due</th><th></th></tr>
        <tr>
          <td align="left">
            <span style="font-weight:bold;">SMITH JOHN</span>
            <div style="margin-left: 8px;">VIN#: 2T1BU4EE5DC123456</div>
          </td>
          <td align="left">2026 01 0999999 01 001<div>2007&nbsp;JAGU</div></td>
          <td align="center"><b>$80.16</b><div>District: 195</div></td>
          <td align="center"><b>$0</b></td>
          <td align="center" style="color:Red;"><span style="font-weight:bold;">$80.16</span></td>
          <td align="center"><a href="VehicleTaxDetails.aspx?Year=2026&amp;Month=1&amp;Receipt=999999&amp;Code=1&amp;Suffix=1">View Details</a></td>
        </tr>
        <tr>
          <td align="left">
            <span style="font-weight:bold;">DOE JANE</span>
            <div style="margin-left: 8px;">VIN#: 1HGBH41JXMN109186</div>
          </td>
          <td align="left">2026 01 0123456 01 001<div>2020&nbsp;HOND</div></td>
          <td align="center"><b>$45.00</b><div>District: 100</div></td>
          <td align="center"><b>$45.00</b><div>01/15/2026</div></td>
          <td align="center"></td>
          <td align="center"><a href="VehicleTaxDetails.aspx?Year=2026&amp;Month=1&amp;Receipt=123456&amp;Code=1&amp;Suffix=1">View Receipt</a></td>
        </tr>
      </table>
    `
    const results = parseVehicleTaxResultsHtml(html)
    expect(results).toHaveLength(2)

    expect(results[0].name).toBe('SMITH JOHN')
    expect(results[0].vin).toBe('2T1BU4EE5DC123456')
    expect(results[0].taxes).toBe('$80.16')
    expect(results[0].district).toBe('195')
    expect(results[0].detailParams).toEqual({
      year: '2026', month: '1', receipt: '999999', code: '1', suffix: '1',
    })

    expect(results[1].name).toBe('DOE JANE')
    expect(results[1].vin).toBe('1HGBH41JXMN109186')
    expect(results[1].paid).toBe('$45.00 01/15/2026')
    expect(results[1].detailParams.receipt).toBe('123456')
  })

  it('returns empty array when no results table', () => {
    const html = '<html><body>No results found</body></html>'
    expect(parseVehicleTaxResultsHtml(html)).toEqual([])
  })

  it('returns empty array when table has only header', () => {
    const html = `
      <table id="tbl_Results">
        <tr><th>Name</th><th>Account #</th><th>Taxes</th><th>Paid</th><th>Amount Due</th><th></th></tr>
      </table>
    `
    expect(parseVehicleTaxResultsHtml(html)).toEqual([])
  })

  it('handles name without VIN', () => {
    const html = `
      <table id="tbl_Results">
        <tr><th>Name</th><th>Account #</th><th>Taxes</th><th>Paid</th><th>Amount Due</th><th></th></tr>
        <tr>
          <td><span style="font-weight:bold;">DOE JANE</span></td>
          <td>2026 01 0999999 01 001</td>
          <td>$50.00 District: 200</td>
          <td>$0</td>
          <td>$50.00</td>
          <td><a href="VehicleTaxDetails.aspx?Year=2026&amp;Month=1&amp;Receipt=999999&amp;Code=1&amp;Suffix=1">View Details</a></td>
        </tr>
      </table>
    `
    const results = parseVehicleTaxResultsHtml(html)
    expect(results).toHaveLength(1)
    expect(results[0].name).toBe('DOE JANE')
    expect(results[0].vin).toBe('')
    expect(results[0].detailParams.receipt).toBe('999999')
  })
})

describe('parseVehicleTaxDetailHtml', () => {
  it('parses all fields from detail page', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">SMITH JOHN</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2025</span>
      <span id="ctl00_bodyContent_lbl_Receipt">2026 01 0999999 01 001</span>
      <span id="ctl00_bodyContent_lbl_VehicleYear">2007</span>
      <span id="ctl00_bodyContent_lbl_VehicleMake">JAGU</span>
      <span id="ctl00_bodyContent_lbl_VehicleModel">S-TYPE</span>
      <span id="ctl00_bodyContent_lbl_VehicleBody">SD</span>
      <span id="ctl00_bodyContent_lbl_VINNumber">2T1BU4EE5DC123456</span>
      <span id="ctl00_bodyContent_lbl_District">195</span>
      <span id="ctl00_bodyContent_lbl_ExpirationDate">1/31/2026</span>
      <span id="ctl00_bodyContent_lbl_Assessment">50</span>
      <span id="ctl00_bodyContent_lbl_CountyMilage">283.10</span>
      <span id="ctl00_bodyContent_lbl_CityMilage">0</span>
      <span id="ctl00_bodyContent_lbl_TotalTaxes">14.16</span>
      <span id="ctl00_bodyContent_lbl_RoadFees">25.00</span>
      <span id="ctl00_bodyContent_lbl_DMVRenewalFee">40.00</span>
      <span id="ctl00_bodyContent_lbl_ProcessingFee">1.00</span>
      <span id="ctl00_bodyContent_lbl_TotalBilled">80.16</span>
      <span id="ctl00_bodyContent_lbl_TotalPaid">0</span>
      <span id="ctl00_bodyContent_lbl_BalanceDue">$80.16</span>
      <span id="ctl00_bodyContent_lbl_DatePaid"></span>
      <span id="ctl00_bodyContent_lbl_Status">Unpaid</span>
    `
    const detail = parseVehicleTaxDetailHtml(html)

    expect(detail.name).toBe('SMITH JOHN')
    expect(detail.levyYear).toBe('2025')
    expect(detail.vehicleYear).toBe('2007')
    expect(detail.vehicleMake).toBe('JAGU')
    expect(detail.vehicleModel).toBe('S-TYPE')
    expect(detail.vin).toBe('2T1BU4EE5DC123456')
    expect(detail.totalBilled).toBe('80.16')
    expect(detail.balanceDue).toBe('$80.16')
    expect(detail.status).toBe('Unpaid')
    expect(detail.datePaid).toBeUndefined() // empty span
  })

  it('handles missing optional fields', () => {
    const html = `
      <span id="ctl00_bodyContent_lbl_Name">DOE JOHN</span>
      <span id="ctl00_bodyContent_lbl_LevyYear">2025</span>
      <span id="ctl00_bodyContent_lbl_Receipt">2026 01 0111111 01 001</span>
    `
    const detail = parseVehicleTaxDetailHtml(html)
    expect(detail.name).toBe('DOE JOHN')
    expect(detail.vehicleMake).toBeUndefined()
    expect(detail.vin).toBeUndefined()
    expect(detail.totalBilled).toBeUndefined()
  })
})
