> 🌐 **English** | [한국어](./DEVELOPMENT.md)

> ℹ️ This is an English translation of [DEVELOPMENT.md](./DEVELOPMENT.md). The Korean version is canonical and may be more up to date.

# Development Guide

Anonymous Chat's development environment setup and workflow.

---

## Table of Contents

- [Overview](#overview)
- [1. Requirements](#1-requirements)
- [2. Installation](#2-installation)
- [3. Project Structure](#3-project-structure)
- [4. Commands](#4-commands)
- [5. Coding Conventions](#5-coding-conventions)
- [6. Workflow for Adding a New Feature](#6-workflow-for-adding-a-new-feature)
- [7. Debugging](#7-debugging)
- [8. Writing Tests](#8-writing-tests)
- [9. Pre-PR Checklist](#9-pre-pr-checklist)
- [10. Directory Responsibilities](#10-directory-responsibilities)
- [11. References](#11-references)

---

## Overview

| Item | Value |
|---|---|
| Language | JavaScript (ESM) |
| Runtime | Cloudflare Workers (Node 18+ compatible) |
| Build tool | esbuild |
| Tests | Vitest |
| Lint | ESLint (flat config) |
| Formatter | Prettier |
| Code stats | Tests 642 cases (41 files), 3 server DOs + Worker router |

---

## 1. Requirements

- **Node.js** 18+
- **npm** 9+
- **Wrangler** 4.x (`^4.110.0`, `npm install -g wrangler`)
- **Git** 2.30+

## 2. Installation

```bash
git clone <repo>
cd Anonymous_Chat
npm install
cp .dev.vars.example .dev.vars
# enter secret values in the .dev.vars file (optional)
```

## 3. Project Structure

### 3.1 Server (Worker)
- `src/worker.js` — main router, HTTP/WS routing
- `src/handlers/` — 8 HTTP handler modules (including security.js)
- `src/middleware/auth.js` — admin authentication
- `src/durable-objects/ChatRoom.js` — WebSocket core
- `src/durable-objects/ChannelRegistry.js` — channel metadata
- `src/durable-objects/DeadDropStore.js` — secret messages
- `src/durable-objects/chat-room/` — ChatRoom helpers (admin, messages, announcements)
- `src/utils/` — 12 utilities (validate, errors, helpers, rate-limiter, security, ...)
- `src/config/constants.js` — all magic numbers (shared server + client)
- `src/config/cors.js` — CORS headers
- `src/schema.js` — JSDoc type definitions (no runtime impact)

### 3.2 Client
- `public/index.html` — main chat page
- `public/administrator.html` — admin dashboard
- `public/announcements.html` — announcement history viewer
- `public/help.html` — usage guide
- `public/privacy.html` — privacy policy
- `public/sw.js` — Service Worker (push notifications)
- `public/manifest.json` — PWA manifest
- `public/_headers` — security header definitions
- `public/_redirects` — redirects (currently unused, handled by the Worker)
- `public/.well-known/security.txt` — RFC 9116
- `public/js/chat.js` — main client (1144 lines)
- `public/js/chat-page.js` — chat page entry point
- `public/js/announcements-page.js` — announcement history page entry point
- `public/js/ui.js` — UI manager + 5 mixins (render, menu, modal, edit, lightbox)
- `public/js/admin-core.js` / `admin-ui.js` / `admin-main.js` — admin SPA (core/UI/entry)
- `public/js/security-center.js` — security center
- `public/js/pages/page-*.js` — 6 admin pages (announcements, bans, channels, logs, messages, users)
- `public/js/api-client.js` — fetch wrapper
- `public/js/websocket.js` — WebSocket manager (reconnect, heartbeat, ephemeral signatures)
- `public/js/signature.js` — Web Crypto API-based HMAC-SHA256 client signature helper
- `public/js/session.js` — session ID, nickname
- `public/js/theme.js` — 9 themes
- `public/js/theme-init.js` — initial theme application (prevents FOUC)
- `public/js/file-upload.js` — file upload (100MB, clipboard, drag and drop)
- `public/js/search.js` — message search (keywords, tags)
- `public/js/push-manager.js` — VAPID + FCM
- `public/js/turnstile.js` — Cloudflare Turnstile
- `public/js/og-preview.js` — OG cards
- `public/js/security-headers.js` — Kalpha Security API
- `public/js/dead-drop.js` — secret messages
- `public/js/sakura.js` — cherry blossom particles
- `public/js/evernight.js` — GIF particles
- `public/js/code-highlight.js` — Prism (npm self-hosted bundle, no CDN)
- `public/js/utils.js` — escapeHtml, isValidUrl, sendErrorReport
- `public/css/themes.css` — 9 theme definitions (869 lines)
- `public/css/base.css` — base styles
- `public/css/animations.css` — animations
- `public/css/code-highlight.css` — code highlighting
- `public/css/prism-tomorrow.css` — Prism One Dark
- `public/css/tailwind.min.css` — built Tailwind

### 3.3 Tests (41 files, 642 cases)
The exact file/case counts are based on the results of running `npm test`. Main areas:
- `test/worker-routes.test.js` — Worker router smoke tests (auth, rate limiting, CSP)
- `test/chat-room*.test.js` — ChatRoom DO (initialization, session keys, message cap, signatures, admin routes)
- `test/security-*.test.js`, `test/risk-scorer.test.js` — security event classification/scoring/logging
- `test/preview.test.js`, `test/summary.test.js`, `test/turnstile.test.js` — handler unit tests
- `test/client-utils.test.js`, `test/client-modules.test.js` — client utilities

### 3.4 Other
- `migrations/` — D1 schema (through 005: 001 admin_logs, 002 log_tables, 003 security_events, 004 admin_logs DROP, 005 security_events strftime index fix)
- `docs/` — detailed documentation
- `wrangler.toml` — Cloudflare configuration
- `package.json` — npm dependencies + scripts
- `eslint.config.js` — ESLint flat config
- `.prettierrc` — Prettier configuration
- `vitest.config.js` — Vitest configuration
- `esbuild.config.js` — esbuild bundle script

## 4. Commands

### 4.1 Development
```bash
npm run dev            # build, then wrangler dev --var ENVIRONMENT:development --port 8788
```

### 4.2 Build
```bash
npm run css            # build Tailwind CSS
npm run bundle         # esbuild bundles (10)
npm run build          # css + bundle + lint
```

### 4.3 Tests
```bash
npm test               # vitest run
npm run test:watch     # watch mode
```

### 4.4 Lint/Format
```bash
npm run lint           # ESLint
npm run lint:fix       # auto-fix
npm run format         # Prettier
```

### 4.5 Deploy
```bash
npm run deploy         # build + wrangler deploy
```

### 4.6 Verification (local)
GitHub Actions and Dependabot are not used (removed 2026-09-16). Run locally before committing:
```bash
npm test               # 642 cases
npm run lint           # 0 errors
npx wrangler deploy --dry-run
```

Deployment is performed automatically by Cloudflare Workers Builds on push.

## 5. Coding Conventions

### 5.1 JavaScript
- ESM modules (`import`/`export`)
- Indentation: 2 spaces (Prettier)
- Quotes: single quotes (`'`) by default, double quotes for JSX attributes
- Semicolons: always
- `===`/`!==` (no loose equality)
- Functions are arrow functions or `function` declarations
- Class methods use method shorthand syntax

### 5.2 JSDoc
Add JSDoc to core modules (server-side first):
```js
/**
 * Validates and broadcasts a message.
 * @param {Object} data - Client message
 * @param {string} sessionId - Session ID
 * @returns {Promise<{success: boolean, messageId?: string}>}
 */
async handleMessage(data, sessionId) { ... }
```

Type definitions: `src/schema.js`

### 5.3 Magic Numbers
**Forbidden**. All defined in `src/config/constants.js`:
```js
// ❌ Bad
if (messages.length > 500) { ... }

// ✅ Good
if (messages.length > MAX_STORED_MESSAGES) { ... }
```

### 5.4 Error Handling
Use the builders in `src/utils/errors.js`:
```js
return jsonError('Invalid request', 400, request.headers.get('Origin'));
return jsonSuccess({ ok: true }, 200, request.headers.get('Origin'));
```

Do not write raw `new Response(JSON.stringify({error:...}), {...})`.

### 5.5 Input Validation
Use `src/utils/validate.js`:
```js
const result = validateClientMessage(data);
if (!result.valid) return jsonError(result.error, 400, origin);
```

When adding a new input type, add a function to `validate.js`.

## 6. Workflow for Adding a New Feature

### 6.1 New HTTP Endpoint
1. Create `src/handlers/your-feature.js`
2. Register it in the `routes` array in `src/worker.js`
3. Add a validation function to `src/utils/validate.js` if needed
4. Add constants to `src/config/constants.js` if needed
5. Add tests in `test/your-feature.test.js`
6. Add the specification to `docs/API.md`
7. Record the change in `CHANGELOG.md`

### 6.2 New Durable Object
1. Create `src/durable-objects/YourDO.js`
2. Add `[[durable_objects.bindings]]` in `wrangler.toml`
3. Add the class to `[[migrations]]` in `wrangler.toml`
4. Add `export { YourDO }` in `src/worker.js`
5. Add `getYourDO()`, `forwardToYourDO()` in `src/utils/do.js`
6. Update `docs/ARCHITECTURE.md`
7. Record in `CHANGELOG.md`

### 6.3 New Theme
1. Add CSS Custom Properties in `public/css/themes.css`
2. Add to the `THEMES` array + `META_COLORS` in `public/js/theme.js`
3. Add Tailwind class overrides in `themes.css`
4. (Optional) Add particle effects in `themes.css`
5. Update `FEATURE_IDEAS.md`

### 6.4 New UI Component
1. Follow the existing mixin pattern (`public/js/ui-*.js`)
2. Create a new mixin file (`public/js/ui-feature.js`)
3. Register with `Object.assign(UIManager.prototype, ...)` at the end of `public/js/ui.js`
4. Add CSS in `themes.css` (theme-compatible)

## 7. Debugging

### 7.1 Worker Logs
```bash
wrangler dev --var ENVIRONMENT:development --port 8788   # console.log output in the console
wrangler tail             # production logs
wrangler tail --format=json
```

### 7.2 D1 Queries
```bash
# Local
wrangler d1 execute anonymous-chat-db --local --command "SELECT * FROM error_logs LIMIT 5"

# Production
wrangler d1 execute anonymous-chat-db --remote --command "SELECT * FROM error_logs LIMIT 5"
```

### 7.3 DO State
Track by instance ID in the `wrangler dev` console. Or add debug logs to the code.

### 7.4 Client
- Chrome DevTools → Network → WS frames
- Application → Service Workers (push debugging)
- Application → Storage (localStorage/sessionStorage/IndexedDB)
- Application → Cache Storage
- Lighthouse → Performance/Accessibility scores

## 8. Writing Tests

### 8.1 Vitest Basics
```js
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/utils/my-module.js';

describe('myFunction', () => {
  it('valid input', () => {
    expect(myFunction('input')).toBe('output');
  });

  it('edge: empty value', () => {
    expect(() => myFunction('')).toThrow();
  });
});
```

### 8.2 Workers Environment
Some modules depend on the Workers runtime (KV, DO, fetch). Mocking:
```js
import { vi } from 'vitest';

const env = {
  DB: { prepare: vi.fn().mockReturnValue({...}) },
  HMAC_SECRET: 'test-secret',
};
```

### 8.3 Coverage Targets
- Utilities (`src/utils/`): 80%+
- Handlers (`src/handlers/`): 70%+
- DO: integration tests (requires a separate runtime, may be skipped)

## 9. Pre-PR Checklist

- [ ] `npm run build` succeeds
- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] `npm run format` applied
- [ ] No secrets/keys included (check `git diff`)
- [ ] Related docs updated
  - [ ] `CHANGELOG.md`
  - [ ] `docs/API.md` (route changes)
  - [ ] `docs/ARCHITECTURE.md` (structure changes)
  - [ ] `docs/SECURITY.md` (security changes)
  - [ ] `README.md` (major changes)
- [ ] Manual browser testing (Chrome, Safari, Firefox, Mobile)
- [ ] Accessibility verification (usable with keyboard only)
- [ ] Zero console errors
- [ ] Lighthouse score maintained

## 10. Directory Responsibilities

```
src/handlers/   ← HTTP handlers (routed by worker.js)
src/utils/      ← reusable utilities
src/middleware/ ← auth/authz middleware
src/config/     ← constants/config (shared server + client)
src/durable-objects/  ← DO classes
src/durable-objects/chat-room/  ← ChatRoom helpers
public/js/      ← client modules
public/css/     ← styles (theme-first)
test/           ← Vitest unit tests
migrations/     ← D1 schema migrations
docs/           ← detailed documentation
```

## 11. References

- [CONTRIBUTING.en.md](../CONTRIBUTING.en.md) — contribution guide
- [docs/ARCHITECTURE.en.md](./ARCHITECTURE.en.md) — architecture
- [docs/API.en.md](./API.en.md) — API specification
- [docs/DEPLOYMENT.en.md](./DEPLOYMENT.en.md) — deployment guide
- [docs/SECURITY.md (Korean)](./SECURITY.md) — security
- [CHANGELOG.md (Korean)](../CHANGELOG.md) — change history
- [FEATURE_IDEAS.md (Korean)](../FEATURE_IDEAS.md) — feature ideas
