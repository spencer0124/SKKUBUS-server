# Pre-Production Audit

## Context

Full-codebase audit before deploying to production. Steps 1-7 of production-ready.md are complete. This document tracks remaining issues found during the audit, categorized by severity.

---

## P0 — MUST FIX (blocks production)

### 1. `npm audit fix` — 10 CVEs (6 high)

**Problem**: `axios` (^1.6.8) has SSRF + DoS CVEs. `express` (^4.18.3) has vulnerable transitive deps (body-parser, qs, path-to-regexp ReDoS, cookie, send XSS). All fixable via `npm audit fix`.

**Status**: DONE
- `npm audit fix` upgraded 17 packages: axios ^1.6.8 → ^1.9.0, express ^4.18.3 → ^4.21.3, plus transitive deps
- `npm audit` → 0 vulnerabilities
- `npm test` → 128/128 passed

---

### 2. Token cache unbounded growth

**Problem**: `lib/authMiddleware.js:4` — `tokenCache` Map grows forever. Expired entries are checked on read (line 28) but never deleted. Slow memory leak under sustained traffic.

**Status**: DONE
- Added `MAX_CACHE_SIZE = 10000` — clears entire cache when limit reached (simple, avoids LRU complexity)
- Added `setInterval` cleanup every 5 minutes — evicts expired entries proactively
- `.unref()` on interval so it doesn't block process exit
- Added 2 tests in `security.test.js` (cache hit verification, size cap)
- `npm test` → 130/130 passed

---

### 3. No axios timeout on fetchers

**Problem**: All `axios.get()` calls lack timeout. If an external API hangs, the fetcher hangs forever, pollers queue up, memory grows.

Files: `hssc.fetcher.js:37`, `jongro.fetcher.js:20,71`, `station.fetcher.js:9`, `search.space.js:27`, `search.building.js:34`, `search.building-detail.js:13`

**Status**: DONE
- Added `{ timeout: 10000 }` (10 seconds) to all 7 `axios.get()` calls
- Files: `hssc.fetcher.js`, `jongro.fetcher.js` (×2), `station.fetcher.js`, `search.space.js`, `search.building.js`, `search.building-detail.js`
- Decision: 10s is generous for typical API responses but prevents indefinite hangs

---

### 4. HSSC and Station fetcher registrations missing `.catch()`

**Problem**: `hssc.fetcher.js:92` and `station.fetcher.js:21` pass async functions directly to `registerPoller()` without `.catch()`. Jongro fetcher already wraps correctly (line 99-104). Unhandled promise rejection risk.

**Status**: DONE
- Wrapped both registrations in arrow functions with `.catch()`, matching Jongro pattern
- `hssc.fetcher.js`: `pollers.registerPoller(() => { updateHSSCBusList().catch(...) }, ...)`
- `station.fetcher.js`: `pollers.registerPoller(() => { updateStation().catch(...) }, ...)`

---

### 5. `lib/firebase.js:7` — `JSON.parse()` without try-catch

**Problem**: If `FIREBASE_SERVICE_ACCOUNT` is malformed JSON, the server crashes at module load. No clean error message.

**Status**: DONE
- Wrapped `JSON.parse()` + `admin.initializeApp()` in try-catch
- Logs descriptive error: `[firebase] Failed to parse FIREBASE_SERVICE_ACCOUNT: ...`
- Server continues without Firebase auth (graceful degradation — auth middleware already handles missing Firebase)

---

### 6. `express.json()` has no explicit body size limit

**Problem**: `index.js:19` — `express.json()` defaults to 100KB. Should be explicit for production clarity and to prevent future Express version changes.

**Status**: DONE
- Changed to `express.json({ limit: "100kb" })` — same default, now explicit
- Decision: 100KB is sufficient for this API (largest POST is ad event at ~200 bytes)

---

## P1 — SHOULD FIX (before launch)

### 7. `search.space.js:28` — query not encoded

**Problem**: `inputQuery` interpolated directly into URL. `search.building.js` uses `encodeQuery()` but `search.space.js` doesn't. URL injection risk.

**Status**: DONE
- Added `const { encodeQuery } = require("./search.helpers")` import
- Changed `${inputQuery}` to `${encodeQuery(inputQuery)}` in URL template
- Now consistent with `search.building.js` pattern

---

### 8. No MongoDB connection check at startup

**Problem**: `lib/db.js:6-11` — lazy connection. If `MONGO_URL` is wrong, server starts fine but all DB routes return 500.

**Status**: DONE
- Added `ping()` function to `lib/db.js` — runs `db.admin().command({ ping: 1 })`
- Called at startup in `index.js` before ad init — non-fatal (warn + continue)
- Decision: non-fatal because bus/station/search features work without MongoDB

---

### 9. Shutdown has no timeout

**Problem**: `index.js:87-94` — if `closeClient()` hangs, process never exits. Docker sends SIGKILL after 30s.

**Status**: DONE
- Added 5s `setTimeout` + `process.exit(1)` as forced exit fallback
- `.unref()` on timer so it doesn't keep event loop alive if cleanup finishes first
- Decision: 5s is well under Docker's default 10s stop_grace_period

---

### 10. `swagger-autogen` in dependencies

**Problem**: `package.json:24` — only used to generate `swagger-output.json` at dev time. Bloats production install.

**Status**: DONE
- Moved `swagger-autogen` from `dependencies` to `devDependencies`
- `npm run swagger` still works in dev; `npm ci --omit=dev` skips it in Docker

---

### 11. No `.env.example`

**Problem**: New developers/deployers have no reference for required env vars.

**Status**: DONE
- Created `.env.example` with all 27 env vars from `lib/config.js`
- Grouped by category: MongoDB, Bus API, Station API, Firebase, Server
- Marked optional vars with defaults

---

### 12. No Node.js version pinning

**Problem**: Docker uses `node:20-alpine` but nothing enforces this for local dev.

**Status**: DONE
- Added `"engines": { "node": ">=20.0.0" }` to `package.json`
- npm warns on mismatch; enforced if `engine-strict=true` in `.npmrc`

---

## P2 — NICE TO HAVE (post-launch)

| # | Finding | File | Status |
|---|---------|------|--------|
| 13 | Error handler logs full stack to stdout | `index.js:60` | PENDING |
| 14 | No request logging (morgan/pino) | `index.js` | PENDING |
| 15 | Docker compose: no `mem_limit` or log rotation | `docker-compose.yml` | PENDING |
| 16 | No readiness probe (`/health/ready`) | `index.js` | PENDING |
| 17 | Fix 4 ESLint warnings (unused vars) | Various | PENDING |
| 18 | Test coverage gaps: search.routes 37%, ad.data 30%, campus.routes 0% | Various | PENDING |
| 19 | MongoClient has no pool config | `lib/db.js:8` | PENDING |
| 20 | Poller overlap possible (no in-flight guard) | `lib/pollers.js` | PENDING |

---

## Files Modified (by item)

| Item | Files | Tests |
|------|-------|-------|
| 1 | `package.json`, `package-lock.json` | `npm audit` |
| 2 | `lib/authMiddleware.js` | `__tests__/security.test.js` |
| 3 | All fetchers + search modules | `__tests__/edge-cases.test.js` |
| 4 | `hssc.fetcher.js`, `station.fetcher.js` | — |
| 5 | `lib/firebase.js` | `__tests__/security.test.js` |
| 6 | `index.js` | — |
| 7 | `search.space.js` | `__tests__/search.test.js` |
| 8 | `lib/db.js`, `index.js` | — |
| 9 | `index.js` | — |
| 10 | `package.json`, `package-lock.json` | — |
| 11 | `.env.example` (new) | — |
| 12 | `package.json` | — |

## Verification

All P0 (1-6) and P1 (7-12) items complete:
1. `npm test` → 130/130 passed
2. `npm run lint` → 0 errors, 4 warnings (pre-existing, tracked in P2 Item 17)
3. `npm audit` → 0 vulnerabilities (Item 1)

P2 items (13-20) deferred to post-launch.
