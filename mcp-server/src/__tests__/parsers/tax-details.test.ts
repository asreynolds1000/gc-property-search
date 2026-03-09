import { describe, it, expect } from 'vitest'
import { parseTaxDetailsHtml } from '../../lib/parsers/tax-details.js'

const PIN = '0538280105300'
const YEAR = '2026'

describe('parseTaxDetailsHtml', () => {
  describe('extractValue with <th> tags', () => {
    it('extracts value when label is in a <th> tag', () => {
      const html = `
        <th>Location</th>
        <td class="value">123 MAIN ST</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.location).toBe('123 MAIN ST')
    })

    it('extracts value when label is in a <td> tag (original behavior)', () => {
      const html = `
        <td>Location</td>
        <td class="value">456 OAK AVE</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.location).toBe('456 OAK AVE')
    })

    it('extracts value when label is in a <span> tag', () => {
      const html = `
        <span>Location</span>
        <span class="value">789 ELM DR</span>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.location).toBe('789 ELM DR')
    })

    it('extracts value when label is in a <label> tag', () => {
      const html = `
        <label>Location</label>
        <td class="value">321 PINE RD</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.location).toBe('321 PINE RD')
    })

    it('extracts Fair Market Value from <th> labels', () => {
      const html = `
        <th>Fair Market Value</th>
        <td>$250,000</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.fairMarketValue).toBe(250000)
    })

    it('extracts Taxable Market Value from <th> labels', () => {
      const html = `
        <th>Taxable Market Value</th>
        <td>$180,000</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxableMarketValue).toBe(180000)
    })
  })

  describe('owner parsing with <th> tags', () => {
    it('parses owner from <th> label', () => {
      const html = `
        <th>Owner</th>
        <td>SMITH JOHN</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.owners).toEqual([{ name: 'SMITH JOHN', relationship: undefined }])
    })

    it('parses owner with relationship code from <th> label', () => {
      const html = `
        <th>Owner</th>
        <td>SMITH JOHN (Jtw), SMITH JANE (Jtw)</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.owners).toHaveLength(2)
      expect(result.owners[0]).toEqual({ name: 'SMITH JOHN', relationship: 'Jtw' })
      expect(result.owners[1]).toEqual({ name: 'SMITH JANE', relationship: 'Jtw' })
    })

    it('parses owner from <td> label (original behavior)', () => {
      const html = `
        <td>Owner</td>
        <td>DOE JANE</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.owners).toEqual([{ name: 'DOE JANE', relationship: undefined }])
    })

    it('parses owner from <label> tag', () => {
      const html = `
        <label>Owner</label>
        <td>JOHNSON BOB</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.owners).toEqual([{ name: 'JOHNSON BOB', relationship: undefined }])
    })
  })

  describe('taxes extraction with nested <span>', () => {
    it('extracts taxes from direct value cell', () => {
      const html = `
        <td>Taxes</td>
        <td>$1,234.56</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxes).toBe(1234.56)
    })

    it('extracts taxes from nested <span> inside <td>', () => {
      const html = `
        <td>Taxes</td>
        <td class="value">
          <span id="lblTaxes">$2,567.89</span>
        </td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxes).toBe(2567.89)
    })

    it('extracts taxes from nested <span> with <th> label', () => {
      const html = `
        <th>Taxes</th>
        <td class="value">
          <span id="lblTaxes">$3,456.78</span>
        </td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxes).toBe(3456.78)
    })

    it('returns undefined taxes when "not available"', () => {
      const html = `
        <td>Taxes</td>
        <td>Not Available</td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxes).toBeUndefined()
    })

    it('returns undefined taxes when no taxes section exists', () => {
      const html = `<td>Location</td><td>123 MAIN ST</td>`
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.taxes).toBeUndefined()
    })
  })

  describe('comprehensive property parsing', () => {
    it('parses a full property HTML with <th> labels', () => {
      const html = `
        <th>Owner</th>
        <th>SMITH JOHN L (Jtw), SMITH SARAH M (Jtw)</th>
        <th>Mailing Address</th>
        <td>123 MAIN ST TAYLORS SC 29687</td>
        <th>Location</th>
        <td>250 MAIN ST</td>
        <th>Acreage</th>
        <td>0.45</td>
        <th>Subdivision</th>
        <td>TAYLORS MILL</td>
        <th>Deed Book-Page</th>
        <td>2890-123</td>
        <th>Deed Date</th>
        <td>01/15/2020</td>
        <th>Sale Price</th>
        <td>$350,000</td>
        <th>Plat Book-Page</th>
        <td>155-45</td>
        <th>Bedrooms/Bathrooms</th>
        <td>3 Bedrooms, 2 Bathrooms, 1 Half Bathrooms</td>
        <th>Square Footage</th>
        <td>2,100</td>
        <th>Land Use</th>
        <td>1100 (Single Family)</td>
        <th>Jurisdiction</th>
        <td>COUNTY</td>
        <th>Homestead</th>
        <td>Yes</td>
        <th>Assessment Class</th>
        <td>MR - Manufacturing Residential</td>
        <th>Fair Market Value</th>
        <td>$425,000</td>
        <th>Taxable Market Value</th>
        <td>$310,000</td>
        <th>Taxes</th>
        <td>
          <span id="lblTaxes">$4,567.89</span>
        </td>
      `
      const result = parseTaxDetailsHtml(html, PIN, YEAR)

      expect(result.mapNumber).toBe(PIN)
      expect(result.taxYear).toBe(YEAR)
      expect(result.owners).toHaveLength(2)
      expect(result.owners[0].name).toBe('SMITH JOHN L')
      expect(result.owners[0].relationship).toBe('Jtw')
      expect(result.mailingAddress).toBe('123 MAIN ST TAYLORS SC 29687')
      expect(result.location).toBe('250 MAIN ST')
      expect(result.acreage).toBe('0.45')
      expect(result.subdivision).toBe('TAYLORS MILL')
      expect(result.deedBook).toBe('2890')
      expect(result.deedPage).toBe('123')
      expect(result.deedDate).toBe('01/15/2020')
      expect(result.salePrice).toBe(350000)
      expect(result.platBook).toBe('155')
      expect(result.platPage).toBe('45')
      expect(result.bedrooms).toBe(3)
      expect(result.bathrooms).toBe(2)
      expect(result.halfBathrooms).toBe(1)
      expect(result.squareFootage).toBe(2100)
      expect(result.landUse).toBe('1100')
      expect(result.landUseDescription).toBe('Single Family')
      expect(result.jurisdiction).toBe('COUNTY')
      expect(result.homestead).toBe(true)
      expect(result.assessmentClass).toBe('MR')
      expect(result.assessmentClassDescription).toBe('Manufacturing Residential')
      expect(result.fairMarketValue).toBe(425000)
      expect(result.taxableMarketValue).toBe(310000)
      expect(result.taxes).toBe(4567.89)
    })

    it('returns empty result for empty HTML', () => {
      const result = parseTaxDetailsHtml('', PIN, YEAR)
      expect(result.mapNumber).toBe(PIN)
      expect(result.taxYear).toBe(YEAR)
      expect(result.owners).toEqual([])
      expect(result.fairMarketValue).toBeUndefined()
      expect(result.taxes).toBeUndefined()
    })
  })

  describe('extractById fallback', () => {
    it('extracts Fair Market Value by ASP.NET control ID', () => {
      const html = `<span id="ctl00_ContentPlaceHolder1_FairMarketValue">$199,000</span>`
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.fairMarketValue).toBe(199000)
    })

    it('extracts Square Footage by ASP.NET control ID', () => {
      const html = `<span id="ctl00_SquareFootLabel">1,800</span>`
      const result = parseTaxDetailsHtml(html, PIN, YEAR)
      expect(result.squareFootage).toBe(1800)
    })
  })
})
