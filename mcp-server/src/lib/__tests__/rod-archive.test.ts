import { describe, it, expect } from 'vitest'
import { buildArchivePath, buildArchiveUrl, buildDeedArchiveUrl, buildPlatArchiveUrl } from '../rod-archive'

describe('buildArchivePath', () => {
  describe('deeds - lettered books', () => {
    it('single letter (A-Z)', () => {
      expect(buildArchivePath('deeds', 'A', 1)).toBe(
        'Deeds\\Books _A- Z\\Book A\\0001.pdf'
      )
    })

    it('double letter (AA-ZZ)', () => {
      expect(buildArchivePath('deeds', 'AA', 173)).toBe(
        'Deeds\\Books _AA- ZZ\\Book AA\\0173.pdf'
      )
    })

    it('triple letter (AAA-ZZZ)', () => {
      expect(buildArchivePath('deeds', 'AAA', 1)).toBe(
        'Deeds\\Books _AAA- ZZZ\\Book AAA\\0001.pdf'
      )
    })

    it('case insensitive', () => {
      expect(buildArchivePath('deeds', 'y', 173)).toBe(
        'Deeds\\Books _A- Z\\Book Y\\0173.pdf'
      )
    })
  })

  describe('deeds - numbered books', () => {
    it('early numbered book (1-99) with zero-padded folder', () => {
      expect(buildArchivePath('deeds', '1', 1)).toBe(
        'Deeds\\Books 0001-099\\Book 01\\0001.pdf'
      )
    })

    it('book 96 in range 0001-099', () => {
      expect(buildArchivePath('deeds', '96', 376)).toBe(
        'Deeds\\Books 0001-099\\Book 96\\0376.pdf'
      )
    })

    it('book 198 in range 0100-199', () => {
      expect(buildArchivePath('deeds', '198', 415)).toBe(
        'Deeds\\Books 0100-199\\Book 198\\0415.pdf'
      )
    })

    it('book 412 in range 0400-499', () => {
      expect(buildArchivePath('deeds', '412', 486)).toBe(
        'Deeds\\Books 0400-499\\Book 412\\0486.pdf'
      )
    })

    it('book 1200 in range 1200-1299', () => {
      expect(buildArchivePath('deeds', '1200', 1)).toBe(
        'Deeds\\Books 1200-1299\\Book 1200\\0001.pdf'
      )
    })
  })

  describe('plats - lettered books', () => {
    it('single letter with plat filename format (3-digit padding)', () => {
      expect(buildArchivePath('plats', 'I', 73)).toBe(
        'Plats\\Books _A - Z\\I\\I 073.pdf'
      )
    })

    it('double letter', () => {
      expect(buildArchivePath('plats', 'AA', 1)).toBe(
        'Plats\\Books _AA - ZZ\\AA\\AA 001.pdf'
      )
    })

    it('triple letter', () => {
      expect(buildArchivePath('plats', 'BBB', 5)).toBe(
        'Plats\\Books _AAA - ZZZ\\BBB\\BBB 005.pdf'
      )
    })
  })

  describe('plats - numbered books', () => {
    it('format 4-A', () => {
      expect(buildArchivePath('plats', '4-A', 1)).toBe(
        'Plats\\Books 04 A-Z\\4-A\\4-A 001.pdf'
      )
    })

    it('format 12-Z', () => {
      expect(buildArchivePath('plats', '12-Z', 50)).toBe(
        'Plats\\Books 12 A-Z\\12-Z\\12-Z 050.pdf'
      )
    })
  })

  describe('indexes', () => {
    it('grantor with date range', () => {
      expect(buildArchivePath('indexes', 'H', 1, { indexType: 'grantor', dateRange: '-1913' })).toBe(
        'Indexes\\Grantor\\-1913\\H\\0001.pdf'
      )
    })

    it('grantee with date range', () => {
      expect(buildArchivePath('indexes', 'A', 5, { indexType: 'grantee', dateRange: '1914-1949' })).toBe(
        'Indexes\\Grantee\\1914-1949\\A\\0005.pdf'
      )
    })

    it('mortgagor', () => {
      expect(buildArchivePath('indexes', 'B', 1, { indexType: 'mortgagor', dateRange: '-1928' })).toBe(
        'Indexes\\Mortgagor\\-1928\\B\\0001.pdf'
      )
    })

    it('federal tax lien (no date range)', () => {
      expect(buildArchivePath('indexes', 'C', 3, { indexType: 'federal_tax_lien' })).toBe(
        'Indexes\\Federal Tax Lien\\C\\0003.pdf'
      )
    })

    it('plat index (section names)', () => {
      expect(buildArchivePath('indexes', 'B1', 10, { indexType: 'plats' })).toBe(
        'Indexes\\Plats\\B1\\0010.pdf'
      )
    })

    it('throws without index_type', () => {
      expect(() => buildArchivePath('indexes', 'A', 1)).toThrow('index_type is required')
    })

    it('throws without date_range for grantor', () => {
      expect(() => buildArchivePath('indexes', 'A', 1, { indexType: 'grantor' })).toThrow('date_range is required')
    })
  })

  describe('land grants', () => {
    it('book A page 1', () => {
      expect(buildArchivePath('land_grants', 'A', 1)).toBe(
        'Land Grants\\Book A\\0001.pdf'
      )
    })
  })

  describe('mortgages', () => {
    it('numbered book', () => {
      expect(buildArchivePath('mortgages', '100', 1)).toBe(
        'Mortgages\\Books 0100-199\\Book 100\\0001.pdf'
      )
    })

    it('early numbered book with zero padding', () => {
      expect(buildArchivePath('mortgages', '1', 1)).toBe(
        'Mortgages\\Books 0001-099\\Book 01\\0001.pdf'
      )
    })
  })

  describe('affidavits', () => {
    it('zero-padded 2-digit book', () => {
      expect(buildArchivePath('affidavits', '1', 1)).toBe(
        'Affidavits\\Book 01\\0001.pdf'
      )
    })

    it('book 42', () => {
      expect(buildArchivePath('affidavits', '42', 10)).toBe(
        'Affidavits\\Book 42\\0010.pdf'
      )
    })
  })

  describe('satisfactions', () => {
    it('no zero padding on book', () => {
      expect(buildArchivePath('satisfactions', '13', 1)).toBe(
        'Satisfactions\\Book 13\\0001.pdf'
      )
    })
  })

  describe('tax maps', () => {
    it('edition name as book', () => {
      expect(buildArchivePath('tax_maps', '1998 Edition', 1)).toBe(
        'Tax Maps\\1998 Edition\\0001.pdf'
      )
    })
  })

  describe('page zero-padding', () => {
    it('pads single digit', () => {
      expect(buildArchivePath('deeds', 'A', 1)).toContain('0001.pdf')
    })

    it('pads double digit', () => {
      expect(buildArchivePath('deeds', 'A', 73)).toContain('0073.pdf')
    })

    it('pads triple digit', () => {
      expect(buildArchivePath('deeds', 'A', 486)).toContain('0486.pdf')
    })

    it('no padding needed for 4+ digits', () => {
      expect(buildArchivePath('deeds', 'A', 1234)).toContain('1234.pdf')
    })
  })
})

describe('buildArchiveUrl', () => {
  it('returns a full URL with encoded UNC path', () => {
    const url = buildArchiveUrl('deeds', 'A', 1)
    expect(url).toContain('Details.aspx?f=')
    expect(url).toContain('synapi.greenvillecounty.org')
    expect(url).toContain(encodeURIComponent('Deeds'))
  })

  it('returns null for invalid input', () => {
    expect(buildArchiveUrl('deeds', '!!!', 1)).toBeNull()
  })
})

describe('buildDeedArchiveUrl', () => {
  it('builds URL from book/page strings', () => {
    const url = buildDeedArchiveUrl('412', '486')
    expect(url).toContain('Details.aspx?f=')
    expect(url).not.toBeNull()
  })

  it('returns null for missing book', () => {
    expect(buildDeedArchiveUrl(null, '486')).toBeNull()
  })

  it('returns null for missing page', () => {
    expect(buildDeedArchiveUrl('412', null)).toBeNull()
  })

  it('returns null for non-numeric page', () => {
    expect(buildDeedArchiveUrl('412', 'abc')).toBeNull()
  })
})

describe('buildPlatArchiveUrl', () => {
  it('builds URL from plat book/page', () => {
    const url = buildPlatArchiveUrl('I', '73')
    expect(url).toContain('Details.aspx?f=')
    expect(url).not.toBeNull()
  })

  it('returns null for missing inputs', () => {
    expect(buildPlatArchiveUrl(null, '73')).toBeNull()
    expect(buildPlatArchiveUrl('I', null)).toBeNull()
  })
})
