# Security Policy

## Supported Versions

We currently provide security updates for the following versions of the project.

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

We take the security of this project very seriously. If you discover a security vulnerability within this project, please report it to us immediately.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to **dev@kalpha.kr** or through the private vulnerability reporting feature on GitHub if available.

Please include the following information in your report:
- A description of the vulnerability and its impact.
- Steps to reproduce the vulnerability.
- Any applicable code snippets or screenshots.
- Possible mitigations or solutions, if known.

We will acknowledge receipt of your vulnerability report within 48 hours and strive to provide a resolution or an update on our progress within 7 days.

## Disclosure Policy

When a vulnerability is reported, we will handle it with the following process:
1. Acknowledge receipt of the report.
2. Verify the vulnerability and prioritize it based on its severity.
3. Develop a patch or mitigation.
4. Notify the reporter when the patch is ready for review.
5. Deploy the patch and release a new version.
6. Publicly acknowledge the vulnerability and the reporter (if desired) in the release notes or a security advisory.

## Current Security Posture

- **WebSocket admission**: `/ws` requires a valid `Origin` header (fail-closed) and a Turnstile ticket issued by `POST /api/turnstile/verify` (2-hour TTL, bound to the connection's session ID; skipped only when `TURNSTILE_SECRET_KEY` is unset). A `join` whose session ID does not match the ticket is closed with code 4401.
- **Observer access**: the admin dashboard connects through a short-lived (5-minute) observer ticket issued by `POST /api/admin/observer-ticket`; the admin token is never placed in the WebSocket URL.
- **Message integrity**: messages and edits are rejected unless signed with the session capability key; signatures older than ±30 seconds are refused, and reconnects without a valid key are closed with code 4401.
- **Admin sessions**: opaque random tokens stored in KV with a 12-hour sliding TTL, revocable server-side on logout, with automatic client logout on 401. All `/api/admin/*` requests are rate-limited to 120 requests per minute per IP.

## AI Data Handling

The AI chat summary feature (`/api/summary`) follows these privacy protections:

- Session IDs are stripped from messages before being sent to the AI model (Cloudflare Workers AI)
- AI model output is not stored externally — summary results are kept only in Durable Object storage along with regular messages
- Summary requests are rate-limited (15 seconds between requests)
- No user-identifying information is included in AI prompts
- The AI system prompt explicitly prohibits including personal information (names, phone numbers, emails, addresses) in outputs