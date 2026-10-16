> 🌐 **English** | [한국어](./CONTRIBUTING.md)

> ℹ️ This is an English translation of [CONTRIBUTING.md](./CONTRIBUTING.md). The Korean version is canonical and may be more up to date.

# Contributing Guide

How to contribute to the Anonymous Chat project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Filing Issues](#filing-issues)
- [Pull Requests](#pull-requests)
- [Coding Conventions](#coding-conventions)
- [Security Contributions](#security-contributions)
- [Testing](#testing)
- [Release Process](#release-process)
- [Contact](#contact)

---

## Code of Conduct

| Principle | Description |
|---|---|
| Mutual respect | All participants are expected to treat each other with respect. |
| Constructive feedback | Aim for improvement rather than criticism. |
| Security reports | Report vulnerabilities via the [SECURITY.md](./SECURITY.md) process, not in public issues. |

---

## Filing Issues

### Before You File

1. Check that [CHANGELOG.md](./CHANGELOG.md) (Korean) doesn't already cover it
2. Check the [docs/](./docs/) directory for related documentation
3. Search for duplicate issues

### Bug Report Checklist

| Item | Description |
|---|---|
| Steps to reproduce | In 1, 2, 3 order |
| Expected result | Correct behavior |
| Actual result | Error/exception behavior |
| Environment | Browser, device, OS |
| Console logs | Full error message |
| Screenshots | Relevant screens |

### Feature Request Checklist

| Item | Description |
|---|---|
| Problem statement | The problem you want to solve |
| Solution | Proposal + alternatives |
| Scope of impact | User/admin perspective |
| Concerns | Security/performance/compatibility |

---

## Pull Requests

### Branch Naming

Prefixes: `feature/`, `bugfix/`, `hotfix/`, `chore/`

| Type | Example |
|---|---|
| Feature | `feature/channel-templates` |
| Bug | `bugfix/fix-websocket-reconnect` |
| Hotfix | `hotfix/xss-sanitize` |
| Other | `chore/bump-deps` |

### Commit Messages (Conventional Commits)

| Type | Purpose |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Refactoring (no behavior change) |
| `test` | Add/update tests |
| `chore` | Build/dependency/tooling changes |

**Examples**

```
feat: add per-channel notification settings
fix: duplicate join message on WebSocket reconnect
docs: document new endpoints in API.md
refactor: extract ChatRoom message validation logic
test: additional rate-limiter cases
chore: update dependencies
```

### PR Checklist

- [ ] Build succeeds (`npm run build`)
- [ ] Tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests added for new features/bug fixes
- [ ] Related docs updated (CHANGELOG, API.md, README, etc.)
- [ ] Security impact reviewed (input validation, auth, XSS, etc.)
- [ ] No secrets/keys included

---

## Coding Conventions

### JavaScript (Common)

| Rule | Description |
|---|---|
| Module system | ESM (`import`/`export`) |
| Documentation | Function/class-level JSDoc (core server-side logic) |
| Constants | Add magic numbers to `src/config/constants.js` |
| Async | Use `async`/`await` |
| Errors | Throw `Error` objects |
| Comparison | Use `===`/`!==` (`==`/`!=` forbidden) |

### Client (`public/js/`)

| Rule | Description |
|---|---|
| UI structure | UI manager uses the mixin pattern (`ui-*.js`) |
| DOM manipulation | Confined to `UIManager` or `chat.js` |
| XSS prevention | Apply `escapeHtml()` |
| Utilities | New utilities go in `public/js/utils.js` first |

### Worker (`src/`)

| Rule | Description |
|---|---|
| Handlers | Modularized under `src/handlers/` |
| Durable Objects | Under `src/durable-objects/` (helper modules in subdirectories such as `chat-room/`) |
| Constants | Add new constants to `src/config/constants.js` (shared by server + client) |
| Input validation | Add to `src/utils/validate.js` |
| Error responses | Use `jsonError`/`jsonSuccess` from `src/utils/errors.js` |

### CSS

| Rule | Description |
|---|---|
| Themes | All 9 supported (CSS Custom Properties) |
| Styling | Tailwind classes + `themes.css` overrides |
| Testing | Verify all: dark/light/midnight/amethyst/sunset/sakura/evernight/ocean/forest |

### File Structure

| Area | Location |
|---|---|
| Client modules | `public/js/` |
| Worker modules | `src/handlers/`, `src/utils/`, `src/middleware/` |
| Durable Objects | `src/durable-objects/`, `src/durable-objects/chat-room/` |
| Shared constants | `src/config/constants.js` |
| Migrations | `migrations/` |
| Tests | `test/` |

---

## Security Contributions

Security-related changes (auth, permissions, input validation, secret handling):

| Step | Description |
|---|---|
| Update docs | [SECURITY.md](./SECURITY.md) + [docs/SECURITY.md](./docs/SECURITY.md) (Korean) |
| PR description | State the changes |
| Risk assessment | Describe risks + mitigations |
| Reporting channel | Report vulnerabilities to dev@kalpha.kr before a public PR |

---

## Testing

### Commands

| Command | Description |
|---|---|
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Watch mode |

### Adding New Handlers/Utilities

| Rule | Description |
|---|---|
| Location | `.test.js` file under `test/` |
| Structure | 1 describe = 1 module, 1 it = 1 case |
| Coverage | Include edge cases (empty values, invalid formats, boundary values) |

### Test Directory Overview

| Area | Files (`test/*.test.js`) |
|---|---|
| Client/shared utilities | `client-utils`, `client-modules`, `api-client`, `constants`, `helpers`, `server-utils`, `validate-extra`, `logger`, `rate-limiter` |
| Security | `security`, `security-classifier`, `risk-scorer`, `security-logger`, `security-routes`, `ban-ip`, `push-ownership`, `body-cap`, `turnstile` |
| Auth/admin | `auth`, `admin-handlers` |
| Chat/DO/session | `chat-room`, `chat-room-init`, `chat-room-messages`, `chat-room-message-cap`, `chat-room-session-key`, `chat-room-admin`, `channel-registry`, `dead-drop-store`, `websocket-observer` |
| Messaging/Worker | `web-push`, `fcm-auth`, `preview`, `summary`, `worker-routes`, `handlers` |
| **Total** | **642 cases / 41 files** |

---

## Release Process

| Step | Action | Command/Location |
|---|---|---|
| 1 | Merge PR into `main` | GitHub |
| 2 | [CHANGELOG.md](./CHANGELOG.md) (Korean) auto-updated | `## 변경 요약` in the PR body |
| 3 | Production deploy | `npm run deploy` (= `wrangler deploy`) |
| 4 | D1 migration (if applicable) | `wrangler d1 migrations apply <DB명> --remote` |

> Before committing, verify locally in this order: `npm test` → `npm run lint` → `npx wrangler deploy --dry-run` (GitHub Actions not used).

---

## Contact

| Type | Channel |
|---|---|
| General | GitHub Issues |
| Security | dev@kalpha.kr |
| License | dev@kalpha.kr |
