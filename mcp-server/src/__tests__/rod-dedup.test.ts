import { describe, it, expect } from 'vitest'
import { GreenvilleROD } from '../lib/api/rod-client.js'
import type { RODDocument } from '../types/rod.js'

// Access deduplicateResults via a test instance
const rod = new GreenvilleROD('test', 'test')

function makeDoc(overrides: Partial<RODDocument>): RODDocument {
  return {
    instId: '1',
    instNum: '2024001',
    book: '2700',
    page: '0001',
    recordDate: '01/15/2024',
    instTypeDesc: 'DEED',
    name: 'SMITH JOHN',
    otherName: 'DOE JANE',
    names: [],
    otherNames: [],
    legalDesc: 'LT 1 PLT BK 1',
    ...overrides,
  }
}

describe('deduplicateResults', () => {
  it('passes through single-party documents unchanged', () => {
    const docs = [
      makeDoc({ instId: '100', name: 'SMITH JOHN', otherName: 'DOE JANE' }),
      makeDoc({ instId: '200', name: 'BAKER BOB', otherName: 'JONES ANN' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(2)
    expect(result[0].names).toEqual(['SMITH JOHN'])
    expect(result[0].otherNames).toEqual(['DOE JANE'])
    expect(result[0].names[0]).toBe(result[0].name) // names[0] === name guarantee
    expect(result[1].names).toEqual(['BAKER BOB'])
  })

  it('merges duplicate instIds with different otherNames', () => {
    // Real pattern: MISCELLANEOUS DEED with multiple parties
    const docs = [
      makeDoc({ instId: '4323724', name: 'AHOP 143 LLC +', otherName: 'ROARK DILLARD NICK +' }),
      makeDoc({ instId: '4323724', name: 'AHOP 143 LLC +', otherName: 'AHOP 143 LLC +' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('AHOP 143 LLC +')
    expect(result[0].names).toEqual(['AHOP 143 LLC +'])
    expect(result[0].otherNames).toEqual(['ROARK DILLARD NICK +', 'AHOP 143 LLC +'])
  })

  it('merges fully identical duplicate rows', () => {
    // Real pattern: RESOLUTION where both rows are identical
    const docs = [
      makeDoc({ instId: '3727882', name: 'AHOP 143 LLC', otherName: 'AHOP 143 LLC' }),
      makeDoc({ instId: '3727882', name: 'AHOP 143 LLC', otherName: 'AHOP 143 LLC' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(1)
    expect(result[0].names).toEqual(['AHOP 143 LLC'])
    expect(result[0].otherNames).toEqual(['AHOP 143 LLC'])
  })

  it('merges documents with different names (multiple grantors)', () => {
    const docs = [
      makeDoc({ instId: '5000', name: 'SMITH JOHN', otherName: 'BANK OF AMERICA' }),
      makeDoc({ instId: '5000', name: 'SMITH JANE', otherName: 'BANK OF AMERICA' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(1)
    expect(result[0].names).toEqual(['SMITH JOHN', 'SMITH JANE'])
    expect(result[0].otherNames).toEqual(['BANK OF AMERICA'])
  })

  it('handles empty otherName (plats have no indirect party)', () => {
    const docs = [
      makeDoc({ instId: '3798252', name: 'AHOP 143 LLC +', otherName: '' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(1)
    expect(result[0].names).toEqual(['AHOP 143 LLC +'])
    expect(result[0].otherNames).toEqual([]) // empty string filtered out
  })

  it('preserves order of first occurrence', () => {
    const docs = [
      makeDoc({ instId: '100', name: 'FIRST' }),
      makeDoc({ instId: '200', name: 'SECOND' }),
      makeDoc({ instId: '100', name: 'FIRST DUPLICATE' }),
      makeDoc({ instId: '300', name: 'THIRD' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(3)
    expect(result[0].instId).toBe('100')
    expect(result[1].instId).toBe('200')
    expect(result[2].instId).toBe('300')
  })

  it('handles mixed unique and duplicate documents', () => {
    // Real-world mix: some unique, some with 2 rows
    const docs = [
      makeDoc({ instId: '4108326', name: 'AHOP 143 LLC +', otherName: 'CLIFFS VALLEY COMMUNITY ASSOCIATION INC +' }),
      makeDoc({ instId: '4108326', name: 'AHOP 143 LLC +', otherName: 'AHOP 143 LLC +' }),
      makeDoc({ instId: '3450064', name: 'AHOP 143 LLC +', otherName: 'AHOP 143 LLC +' }),
      makeDoc({ instId: '3450064', name: 'AHOP 143 LLC +', otherName: 'AHOP 143 LLC +' }),
      makeDoc({ instId: '4651493', name: 'AHOP 143 LLC', otherName: 'JONES LOWELL BRENT TRUSTEE +' }),
    ]
    const result = rod.deduplicateResults(docs)
    expect(result).toHaveLength(3)
    // 4108326: merged two different otherNames
    expect(result[0].otherNames).toEqual(['CLIFFS VALLEY COMMUNITY ASSOCIATION INC +', 'AHOP 143 LLC +'])
    // 3450064: identical rows, only one entry
    expect(result[1].otherNames).toEqual(['AHOP 143 LLC +'])
    // 4651493: unique, single entry
    expect(result[2].names).toEqual(['AHOP 143 LLC'])
  })
})
