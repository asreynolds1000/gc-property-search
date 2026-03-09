# Code + Security Review Fixes (2026-03-08)

Status: COMPLETE

## Context

After V3.1 (commit `b35154f`), ran full code review + security review. All applicable fixes applied and verified.

## Applied

- **C1** CLAUDE.md: Fixed GIS routes POST→GET, updated ROD search docs (no offset, dedup), updated TODOs
- **C2** Removed dead `getDocumentPageCount()` from rod-client.ts
- **I2** Added `combined` case to GIS search API route
- **I3** Added 30s AbortController timeout to GIS client `query()` and `autocomplete()`
- **I4** Removed unused types `RODSearchParams`, `RODSession` from rod.ts
- **H1** Added `encodeURIComponent()` to all interpolated URL params in fetchers.ts
- **H2** Added `/^\d{4}$/` validation on taxYear in tax-details route

## Skipped (by design)

- **I7** Credential pattern: route and component already match (`{ ownerName, username, password }`). Changing would break web UI for no benefit.
- **H4** npm audit: deferred (Next.js/rollup high vulns require major version bump)

## Verification

- 103 tests pass (`npm run test:run`)
- Build clean (`npm run build`)
- No behavior changes for valid inputs
