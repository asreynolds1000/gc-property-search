#!/usr/bin/env node
/**
 * Download electronic-only deed pages from the Greenville County ROD viewer
 * and save as PNG files. Uses the same ROD client as the MCP server.
 *
 * Usage: node scripts/download-deed-pages.mjs <instId> <outputDir> [maxPages]
 * Example: node scripts/download-deed-pages.mjs 2145824 /tmp/deeds 5
 *
 * Requires ROD_USERNAME and ROD_PASSWORD environment variables.
 */

import { GreenvilleROD } from '../mcp-server/dist/lib/api/rod-client.js'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const instId = process.argv[2]
const outputDir = process.argv[3] || '/tmp/rod-downloads'
const maxPages = parseInt(process.argv[4] || '10')

if (!instId) {
  console.error('Usage: node scripts/download-deed-pages.mjs <instId> [outputDir] [maxPages]')
  process.exit(1)
}

const username = process.env.ROD_USERNAME
const password = process.env.ROD_PASSWORD

if (!username || !password) {
  console.error('ROD_USERNAME and ROD_PASSWORD environment variables required')
  process.exit(1)
}

if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true })
}

const rod = new GreenvilleROD(username, password)

console.log(`Downloading instId ${instId} to ${outputDir} (max ${maxPages} pages)`)

let page = 1
let downloaded = 0

while (page <= maxPages) {
  try {
    const buffer = await rod.getDocumentPage(instId, page)
    if (!buffer) {
      console.log(`  Page ${page}: no data (end of document)`)
      break
    }
    const filename = `page-${String(page).padStart(3, '0')}.png`
    const filepath = join(outputDir, filename)
    writeFileSync(filepath, buffer)
    console.log(`  Page ${page}: saved (${(buffer.length / 1024).toFixed(0)}KB)`)
    downloaded++
    page++
  } catch (err) {
    console.error(`  Page ${page}: error — ${err.message}`)
    break
  }
}

console.log(`Done: ${downloaded} pages saved to ${outputDir}`)
