import type { RODDocument, RODVolume, RODNameSearchOptions, RODSearchResult } from '../../types/rod.js'

const ROD_BASE_URL = 'https://viewer.greenvillecounty.org/countyweb'

export class GreenvilleROD {
  private username: string
  private password: string
  private cookies: Map<string, string> = new Map()

  constructor(username: string, password: string) {
    this.username = username
    this.password = password
  }

  private async request(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const cookieHeader = Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          Cookie: cookieHeader,
        },
        redirect: 'manual',
      })

      // Extract and store cookies from response
      const setCookies = response.headers.getSetCookie?.() || []
      for (const cookie of setCookies) {
        const [nameValue] = cookie.split(';')
        const [name, value] = nameValue.split('=')
        if (name && value) {
          this.cookies.set(name.trim(), value.trim())
        }
      }

      return response
    } finally {
      clearTimeout(timeout)
    }
  }

  private async followRedirects(response: Response): Promise<Response> {
    let currentResponse = response
    let maxRedirects = 5

    while (maxRedirects > 0 && (currentResponse.status === 302 || currentResponse.status === 301)) {
      const location = currentResponse.headers.get('location')
      if (!location) break

      const redirectUrl = location.startsWith('http')
        ? location
        : `${ROD_BASE_URL}/${location.replace(/^\/countyweb\//, '')}`

      currentResponse = await this.request(redirectUrl)
      maxRedirects--
    }

    return currentResponse
  }

  private isLoginPage(html: string): boolean {
    return html.includes('loginDisplay.action') || html.includes('CountyFusionForceNewSession')
  }

  private async ensureSession(): Promise<void> {
    if (!this.cookies.has('JSESSIONID')) {
      const loggedIn = await this.login()
      if (!loggedIn) {
        throw new Error('Failed to login to ROD')
      }
    }
  }

  private async executeSearch(searchData: URLSearchParams, sessionId: string, retried = false): Promise<string> {
    const searchResponse = await this.request(
      `${ROD_BASE_URL}/search/searchExecute.do?assessor=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: searchData.toString(),
      }
    )
    await this.followRedirects(searchResponse)

    const resultsResponse = await this.request(
      `${ROD_BASE_URL}/search/Greenville/docs_SearchResultList.jsp?scrollPos=0&searchSessionId=${sessionId}`
    )
    const html = await resultsResponse.text()

    if (!retried && this.isLoginPage(html)) {
      this.cookies.clear()
      await this.login()
      return this.executeSearch(searchData, sessionId, true)
    }

    return html
  }

  async login(): Promise<boolean> {
    // Step 1: Get login page and extract token
    const loginPageResponse = await this.request(
      `${ROD_BASE_URL}/loginDisplay.action?countyname=Greenville`
    )
    const loginPageHtml = await loginPageResponse.text()

    // Extract CSRF token
    const tokenMatch =
      loginPageHtml.match(/name=["']token["'][^>]*value=["']([^"']+)["']/) ||
      loginPageHtml.match(/value=["']([A-Z0-9]{32})["']/)
    const token = tokenMatch ? tokenMatch[1] : ''

    // Step 2: Submit login (this redirects to main.jsp)
    const loginData = new URLSearchParams({
      cmd: 'login',
      countyname: 'Greenville',
      scriptsupport: 'yes',
      CountyFusionForceNewSession: 'true',
      'struts.token.name': 'token',
      token,
      username: this.username,
      password: this.password,
    })

    const loginResponse = await this.request(`${ROD_BASE_URL}/login.action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: loginData.toString(),
    })
    await this.followRedirects(loginResponse)

    // Step 3: Get disclaimer page then accept it
    const disclaimerGetResponse = await this.request(`${ROD_BASE_URL}/disclaimer.do`)
    await this.followRedirects(disclaimerGetResponse)

    // POST to accept disclaimer
    await this.request(`${ROD_BASE_URL}/disclaimer.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'cmd=Accept',
    })

    // Step 4: Set enhanced UI
    await this.request(`${ROD_BASE_URL}/user/setEnhancedUI.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'enhancedUI=true',
    })

    return this.cookies.has('JSESSIONID')
  }

  async searchByBookPage(
    volume: RODVolume,
    book: string,
    page: string
  ): Promise<RODDocument[]> {
    await this.ensureSession()

    const sessionId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const searchData = new URLSearchParams({
      searchCategory: 'ADVANCED',
      searchSessionId: sessionId,
      SEARCHTYPE: 'bookPage',
      RECSPERPAGE: '100',
      INSTTYPEALL: 'selected',
      VOLUME: volume,
      BOOK: book,
      PAGE: page,
      PAGEEND: page,
    })

    const resultsHtml = await this.executeSearch(searchData, sessionId)
    const raw = this.parseResults(resultsHtml)
    return this.deduplicateResults(raw)
  }

  async searchByName(nameOrOptions: string | RODNameSearchOptions): Promise<RODSearchResult> {
    const options: RODNameSearchOptions = typeof nameOrOptions === 'string'
      ? { name: nameOrOptions }
      : nameOrOptions

    await this.ensureSession()

    const sessionId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const searchData = new URLSearchParams({
      searchCategory: 'ADVANCED',
      searchSessionId: sessionId,
      SEARCHTYPE: 'allNames',
      RECSPERPAGE: '100',
      PARTY: options.party || 'both',
      ALLNAMES: options.name,
    })

    // Document type filtering
    if (options.docTypes?.length) {
      for (const type of options.docTypes) searchData.append('INSTTYPE', type)
    } else {
      searchData.set('INSTTYPEALL', 'true')
    }

    // Date range
    if (options.dateFrom) searchData.set('FROMDATE', options.dateFrom)
    if (options.dateTo) searchData.set('TODATE', options.dateTo)

    const resultsHtml = await this.executeSearch(searchData, sessionId)
    let documents = this.parseResults(resultsHtml)

    // Validate results belong to this search -- the ROD portal's server-side cache
    // is keyed by JSESSIONID, not searchSessionId. When a search returns zero real
    // results, the portal may return stale cached results from a previous search.
    // Guard: check that at least one result's name/otherName contains a word from the query.
    if (documents.length > 0) {
      const queryWords = options.name.toUpperCase().split(/\s+/).filter(w => w.length >= 3)
      const anyMatch = documents.some(doc => {
        const docNames = `${doc.name} ${doc.otherName}`.toUpperCase()
        return queryWords.some(word => docNames.includes(word))
      })
      if (!anyMatch) {
        documents = []
      }
    }

    const deduped = this.deduplicateResults(documents)

    return {
      documents: deduped,
      uniqueDocuments: deduped.length,
    }
  }

  private parseResults(html: string): RODDocument[] {
    const results: RODDocument[] = []

    // Parse JavaScript documentRowInfo array
    const pattern = /documentRowInfo\[(\d+)\]\.(\w+)\s*=\s*["']?([^"';]+)["']?/g
    const matches: Map<string, Record<string, string>> = new Map()

    let match
    while ((match = pattern.exec(html)) !== null) {
      const [, idx, prop, value] = match
      if (!matches.has(idx)) {
        matches.set(idx, {})
      }
      matches.get(idx)![prop] = value.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
    }

    // Parse table rows for additional data
    const rowPattern =
      /<tr[^>]*id=["'](\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi
    const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi

    while ((match = rowPattern.exec(html)) !== null) {
      const [, rowId, rowContent] = match
      const tds: string[] = []
      let tdMatch
      while ((tdMatch = tdPattern.exec(rowContent)) !== null) {
        // Strip HTML tags
        const text = tdMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        tds.push(text)
      }

      const jsData = matches.get(rowId) || {}

      if (tds.length >= 12) {
        const instId = jsData.instId || ''
        const recordDate = tds[5] || ''
        results.push({
          instId,
          instNum: jsData.instNum || '',
          book: tds[3] || jsData.book || '',
          page: tds[4] || jsData.page || '',
          recordDate,
          isoDate: this.toIsoDate(recordDate),
          instTypeDesc: tds[6] || '',
          name: tds[8] || '',
          otherName: tds[10] || '',
          names: [],      // populated by deduplicateResults
          otherNames: [],  // populated by deduplicateResults
          legalDesc: tds[11] || '',
          // Pattern sourced from ROD portal's docInfoView.do endpoint
          viewUrl: instId ? `${ROD_BASE_URL}/search/docInfoView.do?instId=${instId}` : undefined,
        })
      }
    }

    // If table parsing didn't work, use JS data
    if (results.length === 0) {
      for (const [, data] of matches) {
        if (data.instId) {
          const recordDate = data.recordDate || ''
          results.push({
            instId: data.instId,
            instNum: data.instNum || '',
            book: data.book || '',
            page: data.page || '',
            recordDate,
            isoDate: this.toIsoDate(recordDate),
            instTypeDesc: data.instTypeDesc || '',
            name: data.name || '',
            otherName: data.otherName || '',
            names: [],
            otherNames: [],
            legalDesc: data.legalDesc || '',
            viewUrl: `${ROD_BASE_URL}/search/docInfoView.do?instId=${data.instId}`,
          })
        }
      }
    }

    return results
  }

  /** Normalize MM/DD/YYYY to YYYY-MM-DD. Returns undefined for malformed dates. */
  private toIsoDate(dateStr: string): string | undefined {
    if (!dateStr) return undefined
    const [m, d, y] = dateStr.split('/')
    if (y?.length === 4 && m?.length <= 2 && d?.length <= 2) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    }
    return undefined
  }

  /** Deduplicate results by instId, merging name/otherName into arrays. */
  deduplicateResults(results: RODDocument[]): RODDocument[] {
    const seen = new Map<string, RODDocument>()
    for (const doc of results) {
      const existing = seen.get(doc.instId)
      if (!existing) {
        doc.names = [doc.name].filter(Boolean)
        doc.otherNames = [doc.otherName].filter(Boolean)
        seen.set(doc.instId, doc)
      } else {
        if (doc.name && !existing.names.includes(doc.name)) {
          existing.names.push(doc.name)
        }
        if (doc.otherName && !existing.otherNames.includes(doc.otherName)) {
          existing.otherNames.push(doc.otherName)
        }
      }
    }
    return Array.from(seen.values())
  }

  async getDocumentPage(
    instId: string,
    pageNumber: number,
    instNum?: string,
    instType?: string
  ): Promise<Buffer | null> {
    if (!this.cookies.has('JSESSIONID')) {
      const loggedIn = await this.login()
      if (!loggedIn) {
        throw new Error('Failed to login to ROD')
      }
    }

    const sessionId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const viewerParams = new URLSearchParams({
      searchSessionId: sessionId,
      instId,
      instNum: instNum || '',
      instType: instType || '',
      assocDoc: 'undefined',
      assocParentNum: 'undefined',
      parcelNum: 'undefined',
      assocType: 'undefined',
      'onloadAction': 'parent.documentLoaded();',
    })

    // Step 1: Call docInfoView.do to set up document context (redirects to DocumentInfoView.jsp)
    const docInfoResp = await this.request(
      `${ROD_BASE_URL}/search/docInfoView.do?${viewerParams.toString()}`
    )
    const docInfoFollowed = await this.followRedirects(docInfoResp)

    // Check for session expiry on docInfoView response
    const docInfoHtml = await docInfoFollowed.text()
    if (this.isLoginPage(docInfoHtml)) {
      // Session expired -- re-login and retry once
      this.cookies.clear()
      const loggedIn = await this.login()
      if (!loggedIn) {
        throw new Error('Failed to re-login to ROD after session expiry')
      }
      return this.getDocumentPage(instId, pageNumber, instNum, instType)
    }

    // Step 2: Call imageViewApplet.do which redirects to InstrumentImageViewInternal.jsp
    const appletResp = await this.request(
      `${ROD_BASE_URL}/imageViewApplet.do?${viewerParams.toString()}`
    )
    await this.followRedirects(appletResp)

    // Step 3: Request the page to load via getPage.do
    const pageResp = await this.request(
      `${ROD_BASE_URL}/imageViewer/getPage.do?addWatermarks=false&isPreview=false&instnum=${instId}&pageNumber=${pageNumber}`,
      {
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'Accept': 'application/json, text/javascript, */*; q=0.01',
        },
      }
    )
    const pageJson = await pageResp.text()

    // Check if page exists (getPage returns status: "success" for valid pages)
    try {
      const pageData = JSON.parse(pageJson)
      if (pageData.status !== 'success') {
        return null
      }
    } catch {
      // If not valid JSON, page doesn't exist
      return null
    }

    // Step 4: Get the image
    const ver = Date.now() * 1000
    const imageResponse = await this.request(
      `${ROD_BASE_URL}/viewImagePNG.do?ver=${ver}&instnum=${instId}&isPreview=false`
    )

    if (!imageResponse.ok) {
      return null
    }

    const contentType = imageResponse.headers.get('content-type')
    if (!contentType?.includes('image')) {
      return null
    }

    const arrayBuffer = await imageResponse.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

}
