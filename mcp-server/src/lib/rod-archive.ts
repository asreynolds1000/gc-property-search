import { execFile } from 'child_process'
import { writeFile, readFile, unlink, access } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { USER_AGENT } from './constants.js'
const UNC_PREFIX = '\\\\synapi.greenvillecounty.org\\rod\\rod\\Webaccess'
const ARCHIVE_BASE_URL = 'https://www.greenvillecounty.org/apps/DirectoryListings/ROD_DirectoryListing/Details.aspx'

// ── Types ──────────────────────────────────────────────────────────

export type ArchiveCategory =
  | 'deeds' | 'plats' | 'indexes' | 'land_grants'
  | 'mortgages' | 'affidavits' | 'satisfactions' | 'tax_maps'

export type IndexType =
  | 'grantor' | 'grantee' | 'mortgagor' | 'mortgagee'
  | 'federal_tax_lien' | 'plats'

export interface ArchivePageOptions {
  indexType?: IndexType
  dateRange?: string
}

// ── Path Builder ───────────────────────────────────────────────────

/**
 * Determine the range folder for a numbered book.
 * Books 1-99 → "Books 0001-099", Books 100-199 → "Books 0100-199", etc.
 * Final range for deeds: Books 1200-1230.
 */
function getNumberedRangeFolder(bookNum: number): string {
  if (bookNum < 100) return 'Books 0001-099'
  const rangeStart = Math.floor(bookNum / 100) * 100
  const rangeEnd = rangeStart + 99
  return `Books ${String(rangeStart).padStart(4, '0')}-${rangeEnd}`
}

/**
 * Determine the lettered group folder for a deed book letter identifier.
 */
function getDeedLetterGroup(book: string): string {
  if (book.length === 1) return 'Books _A- Z'
  if (book.length === 2) return 'Books _AA- ZZ'
  if (book.length === 3) return 'Books _AAA- ZZZ'
  throw new Error(`Invalid deed letter book identifier: ${book}`)
}

/**
 * Determine the lettered group folder for a plat book letter identifier.
 * Note: plats use spaces around the dash (different from deeds).
 */
function getPlatLetterGroup(book: string): string {
  if (book.length === 1) return 'Books _A - Z'
  if (book.length === 2) return 'Books _AA - ZZ'
  if (book.length === 3) return 'Books _AAA - ZZZ'
  throw new Error(`Invalid plat letter book identifier: ${book}`)
}

/**
 * Check if a book identifier is a letter-based reference (A, AA, AAA, etc.)
 * or possibly a numbered book with special format (e.g., "4-A" for plats).
 */
function isLetterBook(book: string): boolean {
  return /^[A-Z]+$/i.test(book)
}

/**
 * Format the page number. Deeds/indexes/etc use 4-digit padding, plats use 3-digit.
 */
function formatPage(page: number, digits: number = 4): string {
  return String(page).padStart(digits, '0')
}

const INDEX_TYPE_FOLDER: Record<IndexType, string> = {
  grantor: 'Grantor',
  grantee: 'Grantee',
  mortgagor: 'Mortgagor',
  mortgagee: 'Mortgagee',
  federal_tax_lien: 'Federal Tax Lien',
  plats: 'Plats',
}

/**
 * Build the UNC path for a specific archive page.
 * Returns the full path (without UNC prefix) or throws on invalid input.
 */
export function buildArchivePath(
  category: ArchiveCategory,
  book: string,
  page: number,
  options?: ArchivePageOptions,
): string {
  const pageStr = formatPage(page)
  const bookUpper = book.toUpperCase()

  switch (category) {
    case 'deeds': {
      if (isLetterBook(bookUpper)) {
        const group = getDeedLetterGroup(bookUpper)
        return `Deeds\\${group}\\Book ${bookUpper}\\${pageStr}.pdf`
      }
      const bookNum = parseInt(book, 10)
      if (isNaN(bookNum)) throw new Error(`Invalid deed book: ${book}`)
      const range = getNumberedRangeFolder(bookNum)
      // Early numbered books use zero-padded 2-digit: Book 01, Book 02...
      const bookFolder = bookNum < 100 ? `Book ${String(bookNum).padStart(2, '0')}` : `Book ${bookNum}`
      return `Deeds\\${range}\\${bookFolder}\\${pageStr}.pdf`
    }

    case 'plats': {
      // Plats use 3-digit page padding (e.g., "I 073.pdf" not "I 0073.pdf")
      const platPageStr = formatPage(page, 3)
      if (isLetterBook(bookUpper)) {
        const group = getPlatLetterGroup(bookUpper)
        // Plats: bare letter folder, filename is "{LETTER} {PAGE}.pdf"
        return `Plats\\${group}\\${bookUpper}\\${bookUpper} ${platPageStr}.pdf`
      }
      // Numbered plats: "4-A" format → "Books 04 A-Z/4-A/4-A {PAGE}.pdf"
      const match = book.match(/^(\d+)-([A-Z])$/i)
      if (!match) throw new Error(`Invalid plat book: ${book}. Use letter (e.g., "A") or numbered format (e.g., "4-A").`)
      const [, num, letter] = match
      const groupNum = String(parseInt(num)).padStart(2, '0')
      const bookId = `${parseInt(num)}-${letter.toUpperCase()}`
      return `Plats\\Books ${groupNum} A-Z\\${bookId}\\${bookId} ${platPageStr}.pdf`
    }

    case 'indexes': {
      if (!options?.indexType) throw new Error('index_type is required for indexes')
      const folder = INDEX_TYPE_FOLDER[options.indexType]
      if (options.indexType === 'federal_tax_lien') {
        // Federal Tax Lien: just letter subfolder
        return `Indexes\\${folder}\\${bookUpper}\\${pageStr}.pdf`
      }
      if (options.indexType === 'plats') {
        // Plat indexes have section names like "A", "B1", "B2", etc.
        return `Indexes\\${folder}\\${bookUpper}\\${pageStr}.pdf`
      }
      // Grantor/Grantee/Mortgagor/Mortgagee: need date_range
      if (!options.dateRange) throw new Error('date_range is required for grantor/grantee/mortgagor/mortgagee indexes')
      return `Indexes\\${folder}\\${options.dateRange}\\${bookUpper}\\${pageStr}.pdf`
    }

    case 'land_grants':
      return `Land Grants\\Book ${bookUpper}\\${pageStr}.pdf`

    case 'mortgages': {
      const bookNum = parseInt(book, 10)
      if (isNaN(bookNum)) throw new Error(`Invalid mortgage book: ${book}`)
      const range = getNumberedRangeFolder(bookNum)
      const bookFolder = bookNum < 100 ? `Book ${String(bookNum).padStart(2, '0')}` : `Book ${bookNum}`
      return `Mortgages\\${range}\\${bookFolder}\\${pageStr}.pdf`
    }

    case 'affidavits': {
      const bookNum = parseInt(book, 10)
      if (isNaN(bookNum)) throw new Error(`Invalid affidavit book: ${book}`)
      return `Affidavits\\Book ${String(bookNum).padStart(2, '0')}\\${pageStr}.pdf`
    }

    case 'satisfactions': {
      const bookNum = parseInt(book, 10)
      if (isNaN(bookNum)) throw new Error(`Invalid satisfaction book: ${book}`)
      return `Satisfactions\\Book ${bookNum}\\${pageStr}.pdf`
    }

    case 'tax_maps':
      // book = edition name (e.g., "1998 Edition", "2005 Edition")
      return `Tax Maps\\${book}\\${pageStr}.pdf`

    default:
      throw new Error(`Unknown category: ${category}`)
  }
}

/**
 * Build the full download URL for an archive page.
 */
export function buildArchiveUrl(
  category: ArchiveCategory,
  book: string,
  page: number,
  options?: ArchivePageOptions,
): string | null {
  try {
    const path = buildArchivePath(category, book, page, options)
    const uncPath = `${UNC_PREFIX}\\${path}`
    return `${ARCHIVE_BASE_URL}?f=${encodeURIComponent(uncPath)}`
  } catch {
    return null
  }
}

/**
 * Build an archive URL from deed book/page references (for enriching existing tool results).
 * Returns null if the book reference can't be mapped.
 */
export function buildDeedArchiveUrl(book: string | null | undefined, page: string | null | undefined): string | null {
  if (!book || !page) return null
  const pageNum = parseInt(page, 10)
  if (isNaN(pageNum) || pageNum < 1) return null
  return buildArchiveUrl('deeds', book.trim(), pageNum)
}

/**
 * Build an archive URL from plat book/page references.
 */
export function buildPlatArchiveUrl(book: string | null | undefined, page: string | null | undefined): string | null {
  if (!book || !page) return null
  const pageNum = parseInt(page, 10)
  if (isNaN(pageNum) || pageNum < 1) return null
  return buildArchiveUrl('plats', book.trim(), pageNum)
}

// ── Fetcher ────────────────────────────────────────────────────────

/**
 * Fetch a PDF page from the archive and convert it to PNG.
 * Returns the PNG buffer or throws with a descriptive error including the direct URL.
 */
export async function fetchArchivePageAsPng(url: string): Promise<Buffer> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: controller.signal,
      redirect: 'follow',
    })

    if (response.status === 500) {
      // County returns 500 for missing files
      throw new Error(`Page not found on archive server. Direct URL: ${url}`)
    }

    if (response.status === 403) {
      const body = await response.text()
      if (body.includes('_Incapsula_Resource') || body.includes('incapsula')) {
        throw new Error(`Request blocked by bot protection. Try accessing directly in browser: ${url}`)
      }
      throw new Error(`Access denied (HTTP 403). Direct URL: ${url}`)
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}. Direct URL: ${url}`)
    }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/pdf')) {
      throw new Error(`Unexpected content type: ${contentType}. Expected PDF. Direct URL: ${url}`)
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer())
    return await convertPdfToPng(pdfBuffer)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Check if pdftoppm is available on the system.
 */
async function checkPdftoppm(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    execFile('which', ['pdftoppm'], (error) => {
      if (error) {
        reject(new Error(
          'pdftoppm not found. Install poppler: brew install poppler (macOS) or apt install poppler-utils (Linux).'
        ))
      } else {
        resolve()
      }
    })
  })
}

/**
 * Convert a single-page PDF to PNG using pdftoppm (from poppler).
 */
async function convertPdfToPng(pdfBuffer: Buffer): Promise<Buffer> {
  await checkPdftoppm()
  const id = `rod_archive_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const pdfPath = join(tmpdir(), `${id}.pdf`)
  const pngBase = join(tmpdir(), id)
  const pngPath = `${pngBase}.png`

  try {
    await writeFile(pdfPath, pdfBuffer)

    await new Promise<void>((resolve, reject) => {
      execFile('pdftoppm', ['-png', '-r', '150', '-singlefile', pdfPath, pngBase], (error) => {
        if (error) reject(new Error(`PDF to PNG conversion failed: ${error.message}`))
        else resolve()
      })
    })

    return await readFile(pngPath)
  } finally {
    // Clean up temp files
    await unlink(pdfPath).catch(() => {})
    await unlink(pngPath).catch(() => {})
  }
}
