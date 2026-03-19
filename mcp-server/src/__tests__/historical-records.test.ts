import { describe, it, expect } from 'vitest'
import { buildHistoricalRecordUrl } from '../lib/historical-records'

describe('buildHistoricalRecordUrl', () => {
  it('builds URL from backslash path and page number', () => {
    const url = buildHistoricalRecordUrl(
      '\\Probate Court\\Will Books\\Book B, 1820 - 1840',
      1
    )
    expect(url).toContain('/RecordsDirectory/Greenville%20County/Probate%20Court/Will%20Books/')
    expect(url).toContain('Book%20B%2C%201820%20-%201840/0001.jpg')
  })

  it('pads page numbers to 4 digits', () => {
    const url = buildHistoricalRecordUrl('\\Probate Court\\Returns\\Book A, 1817 - 1824', 5)
    expect(url).toContain('/0005.jpg')
  })

  it('handles page numbers 4+ digits without extra padding', () => {
    const url = buildHistoricalRecordUrl('\\Probate Court\\Estate Records\\Big Volume', 1234)
    expect(url).toContain('/1234.jpg')
  })

  it('handles leading backslash in path', () => {
    const url = buildHistoricalRecordUrl('\\Register of Deeds\\Conveyance Books\\Book AA 1865 - 1868', 1)
    expect(url).toContain('/Register%20of%20Deeds/')
    expect(url).toContain('/Book%20AA%201865%20-%201868/')
  })

  it('handles path without leading backslash', () => {
    const url = buildHistoricalRecordUrl('Probate Court\\Will Books\\Book A', 1)
    expect(url).toContain('/Probate%20Court/')
  })

  it('encodes special characters in volume names', () => {
    const url = buildHistoricalRecordUrl(
      '\\Register of Deeds\\Conveyance Books\\Book ZZ 1892-1897 & 1899',
      1
    )
    expect(url).toContain('Book%20ZZ%201892-1897%20%26%201899')
  })

  it('encodes apostrophes in office names', () => {
    const url = buildHistoricalRecordUrl("\\Sheriff's Office\\Execution Books\\Book 1", 1)
    expect(url).toContain("Sheriff's%20Office")
  })

  it('throws on empty path', () => {
    expect(() => buildHistoricalRecordUrl('', 1)).toThrow('Path is required')
    expect(() => buildHistoricalRecordUrl('\\', 1)).toThrow('Path is required')
  })
})
