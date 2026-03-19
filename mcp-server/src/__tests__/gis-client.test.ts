import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GreenvilleGIS, jurisdictionFromPin } from '../lib/api/gis-client.js'

// Test the sanitization patterns used in gis-client.ts
describe('GIS Client Sanitization', () => {
  describe('SQL sanitization for WHERE clauses', () => {
    // Simulate the sanitizeForSql function behavior
    function sanitizeForSql(input: string, escapeLikeWildcards = true): string {
      let sanitized = input.replace(/'/g, "''")
      if (escapeLikeWildcards) {
        sanitized = sanitized.replace(/%/g, '\\%').replace(/_/g, '\\_')
      }
      return sanitized
    }

    it('escapes single quotes', () => {
      expect(sanitizeForSql("O'Brien")).toBe("O''Brien")
      expect(sanitizeForSql("'test'")).toBe("''test''")
    })

    it('escapes LIKE wildcards', () => {
      expect(sanitizeForSql('100%')).toBe('100\\%')
      expect(sanitizeForSql('test_value')).toBe('test\\_value')
    })

    it('handles multiple special characters', () => {
      expect(sanitizeForSql("O'Brien's 100% _test")).toBe("O''Brien''s 100\\% \\_test")
    })

    it('handles empty string', () => {
      expect(sanitizeForSql('')).toBe('')
    })

    it('handles string with no special characters', () => {
      expect(sanitizeForSql('JOHN SMITH')).toBe('JOHN SMITH')
    })
  })

  describe('PIN validation', () => {
    // Simulate the isValidPin function behavior
    function isValidPin(pin: string): boolean {
      return /^[A-Za-z0-9-]+$/.test(pin)
    }

    it('accepts valid PINs with digits', () => {
      expect(isValidPin('0123456789012')).toBe(true)
    })

    it('accepts valid PINs with letters', () => {
      expect(isValidPin('ABC123DEF4567')).toBe(true)
    })

    it('accepts PINs with dashes', () => {
      expect(isValidPin('123-456-789')).toBe(true)
    })

    it('rejects PINs with SQL injection characters', () => {
      expect(isValidPin("123' OR '1'='1")).toBe(false)
      expect(isValidPin('123; DROP TABLE')).toBe(false)
      expect(isValidPin('123/*comment*/')).toBe(false)
    })

    it('rejects PINs with spaces', () => {
      expect(isValidPin('123 456')).toBe(false)
    })

    it('rejects empty string', () => {
      expect(isValidPin('')).toBe(false)
    })
  })
})

describe('jurisdictionFromPin', () => {
  it('maps T prefix to Taylors', () => {
    expect(jurisdictionFromPin('T012345678900')).toBe('Taylors')
  })

  it('maps G prefix to Greer', () => {
    expect(jurisdictionFromPin('G016000601700')).toBe('Greer')
  })

  it('maps M prefix to Mauldin', () => {
    expect(jurisdictionFromPin('M123456789000')).toBe('Mauldin')
  })

  it('maps P prefix to Parker', () => {
    expect(jurisdictionFromPin('P000000000000')).toBe('Parker')
  })

  it('maps S prefix to Simpsonville', () => {
    expect(jurisdictionFromPin('S999999999999')).toBe('Simpsonville')
  })

  it('maps numeric prefix to Unincorporated Greenville County', () => {
    expect(jurisdictionFromPin('0544020103500')).toBe('Unincorporated Greenville County')
    expect(jurisdictionFromPin('9000000000000')).toBe('Unincorporated Greenville County')
  })

  it('is case-insensitive', () => {
    expect(jurisdictionFromPin('t012345678900')).toBe('Taylors')
    expect(jurisdictionFromPin('g016000601700')).toBe('Greer')
  })

  it('returns undefined for unknown prefixes', () => {
    expect(jurisdictionFromPin('X000000000000')).toBeUndefined()
    expect(jurisdictionFromPin('Z999999999999')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(jurisdictionFromPin('')).toBeUndefined()
  })
})

// Helper to capture the WHERE clause from a GIS fetch call
function getWhereFromFetchCall(mockFetch: ReturnType<typeof vi.fn>, callIndex = 0): string {
  const url = new URL(mockFetch.mock.calls[callIndex][0])
  return url.searchParams.get('where') || ''
}

function createMockFetch(features: unknown[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ features }),
  })
}

describe('GIS Client Integration', () => {
  let gisClient: GreenvilleGIS

  beforeEach(() => {
    vi.clearAllMocks()
    gisClient = new GreenvilleGIS()
  })

  it('constructs proper URLs for queries', async () => {
    global.fetch = createMockFetch()
    await gisClient.searchByPin('1234567890123')

    expect(global.fetch).toHaveBeenCalled()
    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(calledUrl).toContain('gcgis.org')
    expect(calledUrl).toContain('PIN')
  })

  describe('searchByAddress', () => {
    it('builds LIKE query for street name', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%MILL%'")
    })

    it('quotes STRNUM as a string field', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', 250)

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("STRNUM = '250'")
      // Should NOT be unquoted numeric
      expect(where).not.toMatch(/STRNUM = 250[^']/)
    })

    it('appends city filter when provided', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', undefined, 'TAYLORS')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("CITY = 'TAYLORS'")
    })

    it('includes both street number and city in WHERE clause', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', 250, 'TAYLORS')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%MILL%'")
      expect(where).toContain("STRNUM = '250'")
      expect(where).toContain("CITY = 'TAYLORS'")
    })

    it('uses exact match with = instead of LIKE when exactMatch is true', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', undefined, undefined, true)

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE = 'MILL'")
      expect(where).not.toContain('LIKE')
    })

    it('combines exact match with city filter', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', undefined, 'TAYLORS', true)

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE = 'MILL'")
      expect(where).toContain("CITY = 'TAYLORS'")
    })

    it('sanitizes city name for SQL injection', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MAIN', undefined, "O'BRIEN")

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("CITY = 'O''BRIEN'")
    })

    it('ignores invalid street numbers (zero, negative)', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('MILL', 0)

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).not.toContain('STRNUM')
    })
  })

  describe('searchByAddress - street suffix stripping', () => {
    it('strips common suffix "LN" from street name', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('NOBLE WING LN')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%NOBLE WING%'")
      expect(where).not.toContain('LN')
    })

    it('strips longer suffixes like "LANE"', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('NOBLE WING LANE')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%NOBLE WING%'")
      expect(where).not.toContain('LANE')
    })

    it('strips "DR", "DRIVE", "ST", "AVE", "BLVD", "CT"', async () => {
      global.fetch = createMockFetch()

      for (const suffix of ['DR', 'DRIVE', 'ST', 'AVE', 'BLVD', 'CT']) {
        await gisClient.searchByAddress(`MAIN ${suffix}`)
        const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
        expect(where).toContain("LOCATE LIKE '%MAIN%'")
        expect(where).not.toContain(suffix)
      }
    })

    it('is case-insensitive for suffix stripping', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('Noble Wing Ln')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('NOBLE WING')
      expect(where).not.toContain('LN')
    })

    it('does not strip suffix if street is a single word', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('LANE')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('LANE')
    })

    it('does not strip non-suffix trailing words', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('NOBLE WING')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('NOBLE WING')
    })
  })

  describe('searchByAddress - street number extraction', () => {
    it('extracts leading number from street string', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('31 Noble Wing')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%NOBLE WING%'")
      expect(where).toContain("STRNUM = '31'")
    })

    it('extracts number and strips suffix together', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('31 Noble Wing Ln')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("LOCATE LIKE '%NOBLE WING%'")
      expect(where).toContain("STRNUM = '31'")
      expect(where).not.toContain('LN')
    })

    it('prefers explicit street_number over extracted number', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('31 Noble Wing', 42)

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      // Explicit number=42 takes precedence; "31" stays in street name
      expect(where).toContain("STRNUM = '42'")
    })

    it('does not extract if no leading number', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchByAddress('Noble Wing')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).not.toContain('STRNUM')
    })
  })

  describe('searchCombined', () => {
    it('builds OWNAM1 OR OWNAM2 OR address WHERE clause', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('SMITH MAIN')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('OWNAM1')
      expect(where).toContain('OWNAM2')
      expect(where).toContain('LOCATE')
      expect(where).toContain('SMITH')
      expect(where).toContain('MAIN')
    })

    it('appends city filter when provided', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('MILL', 'TAYLORS')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("CITY = 'TAYLORS'")
      expect(where).toContain('OWNAM1')
      expect(where).toContain('OWNAM2')
      expect(where).toContain('LOCATE')
    })

    it('wraps combined conditions before applying city filter', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('MAIN', 'GREENVILLE')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      // City should apply to the whole OR clause, not just one branch
      expect(where).toMatch(/\(.*OR.*\) AND CITY/)
    })

    it('returns empty array for short/empty terms', async () => {
      global.fetch = createMockFetch()
      const results = await gisClient.searchCombined('a b')

      expect(global.fetch).not.toHaveBeenCalled()
      expect(results).toEqual([])
    })

    it('filters out street suffixes from search terms', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('Noble Wing Lane')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('NOBLE')
      expect(where).toContain('WING')
      expect(where).not.toContain('LANE')
    })

    it('filters short words AND suffixes together', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('31 Noble Wing Ln')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      // "31" dropped (< 3 chars), "Ln" dropped (< 3 chars), leaves NOBLE + WING
      expect(where).toContain('NOBLE')
      expect(where).toContain('WING')
      expect(where).not.toContain("'31'")
    })

    it('filters longer suffixes like DRIVE and AVENUE', async () => {
      global.fetch = createMockFetch()
      await gisClient.searchCombined('NOBLE WING DRIVE')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain('NOBLE')
      expect(where).toContain('WING')
      expect(where).not.toContain('DRIVE')
    })

    it('returns empty if all terms are suffixes or short words', async () => {
      global.fetch = createMockFetch()
      const results = await gisClient.searchCombined('Ln Dr')

      expect(global.fetch).not.toHaveBeenCalled()
      expect(results).toEqual([])
    })
  })

  describe('searchByOwner', () => {
    it('queries both OWNAM1 and OWNAM2 fields', async () => {
      global.fetch = createMockFetch([{ attributes: { PIN: '123' } }])
      await gisClient.searchByOwner('SMITH')

      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("OWNAM1 LIKE 'SMITH%'")
      expect(where).toContain("OWNAM2 LIKE 'SMITH%'")
      expect(where).toContain(' OR ')
    })

    it('finds properties by secondary owner name', async () => {
      // Simulates OWNAM2 match -- result comes back because WHERE includes OWNAM2
      global.fetch = createMockFetch([{ attributes: { PIN: '123', OWNAM1: 'DOE AMY', OWNAM2: 'DOE DANIEL' } }])
      const results = await gisClient.searchByOwner('DOE DANIEL')

      expect(results).toHaveLength(1)
      const where = getWhereFromFetchCall(global.fetch as ReturnType<typeof vi.fn>)
      expect(where).toContain("OWNAM2 LIKE 'DOE DANIEL%'")
    })

    it('retries with swapped first/last when 0 results and 2+ words', async () => {
      const mockFetch = vi.fn()
        // First call: no results
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ features: [] }),
        })
        // Second call (swapped): has results
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ features: [{ attributes: { PIN: '123' } }] }),
        })
      global.fetch = mockFetch

      const results = await gisClient.searchByOwner('John Smith')

      // Should have been called twice
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // First call: original order, both fields
      const firstWhere = getWhereFromFetchCall(mockFetch, 0)
      expect(firstWhere).toContain("OWNAM1 LIKE 'JOHN SMITH%'")
      expect(firstWhere).toContain("OWNAM2 LIKE 'JOHN SMITH%'")

      // Second call: swapped to "SMITH JOHN", both fields
      const secondWhere = getWhereFromFetchCall(mockFetch, 1)
      expect(secondWhere).toContain("OWNAM1 LIKE 'SMITH JOHN%'")
      expect(secondWhere).toContain("OWNAM2 LIKE 'SMITH JOHN%'")

      expect(results).toHaveLength(1)
    })

    it('does not retry for single-word queries with 0 results', async () => {
      global.fetch = createMockFetch([])
      const results = await gisClient.searchByOwner('SMITH')

      expect(global.fetch).toHaveBeenCalledTimes(1)
      expect(results).toEqual([])
    })

    it('does not retry when first query has results', async () => {
      global.fetch = createMockFetch([{ attributes: { PIN: '123' } }])
      await gisClient.searchByOwner('John Smith')

      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it('swaps correctly with 3+ word names and includes OWNAM2', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ features: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ features: [] }),
        })
      global.fetch = mockFetch

      await gisClient.searchByOwner('John Paul Smith')

      expect(mockFetch).toHaveBeenCalledTimes(2)
      // "JOHN PAUL SMITH" -> swap last word to front: "SMITH JOHN PAUL"
      const secondWhere = getWhereFromFetchCall(mockFetch, 1)
      expect(secondWhere).toContain("OWNAM1 LIKE 'SMITH JOHN PAUL%'")
      expect(secondWhere).toContain("OWNAM2 LIKE 'SMITH JOHN PAUL%'")
    })
  })
})
