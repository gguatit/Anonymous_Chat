> 🌐 **English** | [한국어](./QNA.md)

> ℹ️ This is an English translation of [QNA.md](./QNA.md). The Korean version is canonical and may be more up to date.

# Q&A Collection (In-Depth Answers)

> Extra questions not covered in the presentation + deeper answers  
> For interviews, seminars, and portfolio reviews

---

## Technical Architecture Deep Dive

### Q: Explain the full flow of a single WebSocket message

**A**: The flow from client → server → other clients:

```
[Client A]                          [Cloudflare Edge]              [ChatRoom DO]
   │                                       │                              │
   │ 1. WSS Handshake (Upgrade)             │                              │
   ├──────────────────────────────────────▶│                              │
   │                                       │ 2. /ws routing              │
   │                                       ├─────────────────────────────▶│
   │                                       │                              │ 3. WS Pair created
   │                                       │                              │    ipConnections++
   │                                       │                              │    this.sessions.set(sid, ws)
   │                                       │                              │
   │ 4. {type:"handshake", secret, key,     │                              │
   │     authorId:...}                      │                              │
   │◀──────────────────────────────────────┤◀─────────────────────────────┤
   │                                       │                              │
   │ 5. crypto.subtle.importKey(secret)    │                              │
   │                                       │                              │
   │ 6. {type:"message",                    │                              │
   │     content:"hi",                      │                              │
   │     sessionId:"user_abc",              │                              │
   │     timestamp: 1234567890,             │                              │
   │     signature: HMAC(...)}              │                              │
   ├──────────────────────────────────────▶│                              │
   │                                       │ 7. verifyMessageSignature()   │
   │                                       ├─────────────────────────────▶│
   │                                       │                              │ 8. validateClientMessage()
   │                                       │                              │    - type check
   │                                       │                              │    - length check (7500 chars)
   │                                       │                              │    - file info check
   │                                       │                              │
   │                                       │                              │ 9. this.messages.push(msg)
   │                                       │                              │ 10. broadcast()
   │                                       │                              │     for (other of sessions) {
   │                                       │                              │       if (other !== sender)
   │                                       │                              │         other.send(msg)
   │                                       │                              │     }
   │                                       │                              │
   │                          11. to other clients│                        │
   │◀──────────────────────────────────────┤◀─────────────────────────────┤
```

Key points:
- **Single-threaded (DO)** means steps 8-10 are **atomic** — no race conditions
- Messages stored in **two places** (memory + persistent storage) to survive restarts
- **12-hour cleanup** runs on a separate interval

---

### Q: Does the "single thread" of Durable Objects really guarantee integrity?

**A**: **Partially.**

✅ Guaranteed:
- Within one DO instance, **incoming requests are processed sequentially** (input gate)
- So there is no race condition between `this.messages.push()` and `this.sessions.get()`

❌ Not guaranteed:
- The **Storage API** (`state.storage.put()`) is async → other requests can interleave across awaits
- Communication **between different DO instances** is RPC, so there is no consistency
- After **eviction and restart**, in-memory state is gone (reloaded from Storage)

What we were careful about in the real code:
```javascript
// ❌ Dangerous code
const msg = this.messages.pop();
await this.state.storage.put("messages", this.messages); // ← yields here

// ✅ Safe code
const msg = this.messages.pop();
const newList = [...this.messages];
await this.state.storage.put("messages", newList); // explicit snapshot
```

---

### Q: How do you handle message loss on WebSocket reconnect?

**A**: With **capability key verification + recent message batch**:

1. On reconnect the client sends `join {sessionId, key}` (the first connection sends only `sessionId`)
2. The server (`ChatRoom`) compares it against the stored key in constant time → on a match, issues a new `secret` + rotated `key` + `authorId` in a `handshake`
3. Missing/mismatched key (existing session) → **close 4401** → the client generates a new sessionId and reconnects once
4. Immediately after connecting, the **latest 100 messages are sent as a batch** (there is no separate `sync` message type)
5. If the DO was evicted, the key and messages are restored from Storage and handled the same way

```javascript
// handshake (server → client)
{ type: 'handshake', secret, key, authorId }

// reconnect (client → server)
{ type: 'join', sessionId, key }
```

**Limitation**: messages older than 12 hours are gone and cannot be recovered. The client UI therefore shows a "Previous messages cannot be displayed" toast.

---

### Q: How do you send push notifications to offline users?

**A**: With a **Cloudflare Workers AI + KV + Web Push** combination:

1. The user subscribes to push in `chat.js` → `serviceWorker.pushManager.subscribe()`
2. The subscription is stored in KV: `sub:<sha256(sessionId)> → { endpoint, keys: {p256dh, auth} }` (subscribe/unsubscribe require the capability `key`; 401 without it)
3. A new message arrives → the ChatRoom DO runs `this.broadcast()`
4. Check whether each WS responded → look up KV subscriptions for users that didn't (offline)
5. Send the push payload with **VAPID + RFC 8291 encryption**
6. The `serviceWorker` `push` event → `showNotification()`

```javascript
// handlers/push.js (simplified)
async function broadcastPush(env, message) {
  const subs = await env.PUSH_SUBSCRIPTIONS.list();
  for (const sub of subs.keys) {
    const data = await env.PUSH_SUBSCRIPTIONS.get(sub.name);
    const vapidHeaders = generateVAPIDHeaders(...);
    const encrypted = encryptPayload(message, ...);
    await fetch(data.endpoint, {
      method: 'POST',
      headers: { 'Authorization': vapidHeaders, ... },
      body: encrypted
    });
  }
}
```

**Send limits**: looks up up to KV_LIST_LIMIT 1,000 entries; actual delivery is batched in PUSH_BATCH_SIZE chunks of 20.

---

## Security Deep Dive

### Q: What happens if an HMAC key leaks?

**A**: It depends on the leak path.

| Leak Path | Impact | Response |
|-----------|------|------|
| Client browser memory | Forged messages for that session possible. Automatically discarded when the session ends | Removed from memory on WS close |
| `wrangler secret` | An `HMAC_SECRET` leak allows forging internal DO tokens, Turnstile tickets, and authorIds (admin tokens are random KV values and unaffected; message signing uses per-session secrets) | Rotate immediately via `wrangler secret put`. Notify all users to "reconnect" |
| Storage DB | No impact (no secrets stored in the DB) | - |
| Public GitHub | **Rotation mandatory** | Never commit (`.dev.vars` is in `.gitignore`) |

**Current state**: separation is complete.
- admin token — opaque random KV value (`token:<id>` → expiry info). No separate `ADMIN_TOKEN_SECRET` needed
- message signing — per-session ephemeral secret + capability key, independent of `HMAC_SECRET`
- only the internal DO token (`X-Admin-Internal-Token`) still shares `HMAC_SECRET` (Worker↔DO boundary internal use only)

---

### Q: How do you defend against CSRF?

**A**: A combination of 3 mechanisms.

1. **Require a custom header** — callable only via `fetch()` (not `<form>`)
   ```javascript
   // handlers/admin.js
   const authHeader = request.headers.get('Authorization');
   if (!authHeader?.startsWith('Bearer ')) return 401;
   ```

2. **CORS allowlist** — only origins registered in `cors.js` get a response
   ```javascript
   'Access-Control-Allow-Origin': 'https://kalpha.mmv.kr'
   'Access-Control-Allow-Credentials': 'true'
   ```

3. **No SameSite cookies** — the Bearer token lives in `localStorage`, so cookies aren't sent automatically → baseline CSRF defense

4. **POST endpoints validate body size by counting stream bytes** (413 when exceeded)

However, **public endpoints like `/api/upload`** have no CSRF token. But that's a side-effect-free GET/POST upload, so it's not a real problem.

---

### Q: What if an admin maliciously alters user messages?

**A**: **They can**. And that's intended behavior.

Admins hold system operations privileges, so they can:
- Edit/delete messages (recorded in the audit log)
- Ban users (Triple-ban)
- Force-delete channels

**Defenses**:
- Every admin action is recorded in the `audit_logs` D1 table (tamper-proof, preserving timestamp, IP, and details)
- Security events are recorded separately in `security_events`
- CSV export enables external backups

**Remaining risk**: what if an admin deletes the DB itself? → This is the "insider threat" domain, hard for any SaaS to stop. Only **separation of duties** (2+ admins) + an **external SIEM** can defend against it.

---

## Performance Deep Dive

### Q: How much does one message cost?

**A**: As of June 2026 (Cloudflare pricing):

| Item | Cost |
|------|------|
| Worker request | $0.0000005 (5×10⁻⁷) |
| Worker CPU per ms | $0.000002 |
| DO request | $0.0000005 |
| DO memory per GB-second | $0.000000154 |
| D1 read per row | $0.000001 |
| D1 write per row | $0.00001 |
| KV read | $0.0000005 |
| KV write | $0.000005 |

One message = 1 WS message (sender) + N (receivers)
- WS send/receive: Worker + 2 DOs = ~$0.000001
- 1 D1 audit log write: $0.00001
- **Total: $0.000011/message** (with 1 receiver)
- With 10 receivers: $0.0001/message

1,000,000 messages/month → roughly **$10-100** (depending on receiver count)

---

### Q: Isn't bundle.js at 136KB large?

**A**: It depends on what you compare it to.

- React + ReactDOM + React Router alone: ~140KB
- Next.js starter: ~80KB
- Our chat.bundle.js: 136KB (gzip ~40KB)
- 1990s AOL Messenger: 4MB+

**Improvements**:
- ✅ **Already applied**: esbuild code splitting → the initial load only fetches the core of chat.bundle.js; the rest is lazy-loaded
- ❌ **Not applied**:
  - Dynamic import for admin pages (already applied)
  - Worker-based HTML minification (wrangler default)
  - Brotli compression (automatic on Cloudflare)

**gzip 40KB** loads in under a second on mobile 3G → reasonable at this size.

---

## Development Experience Deep Dive

### Q: How would you refactor the 1,735-line ChatRoom.js?

**A**: With a **split by responsibility** strategy:

```
src/durable-objects/ChatRoom/
  ├── index.js          // entry point (thin wrapper over the current ChatRoom.js)
  ├── state.js          // message/session/reaction Map management
  ├── connection.js     // WebSocket connect/disconnect/heartbeat
  ├── broadcast.js      // fan-out logic
  ├── messages.js       // message CRUD (already split out)
  ├── admin.js          // admin actions (already split out)
  ├── announcements.js  // announcements (already split out)
  ├── persistence.js    // DO Storage read/write
  ├── cleanup.js        // 12-hour retention, interval
  └── audit.js          // audit log writes
```

Each file stays under **300 lines**. Landed as step-by-step PRs (lower risk).

---

### Q: How will you increase test coverage?

**A**: Most of the priority areas now have tests (651 cases / 41 files in total):

1. **`utils/validate.js` (input validation)** — done (including validate-extra)
2. **`utils/helpers.js` HMAC functions** — done
3. **`worker.js` router** — done (worker-routes smoke)
4. **`ChatRoom DO`** — done (chat-room*.test.js: init/cap/session-key/admin etc.)
5. **`handlers/push.js`, `summary.js`, `preview.js`, `turnstile.js`** — done
6. **Security paths** — done (observer, body-cap, ban-ip, push-ownership etc.)

The remaining task is the **coverage threshold**. `vitest.config.js` still has no coverage provider/threshold; the next step is pinning targets (utils 80% / handlers 70%) as a CI gate.

---

## Comparison / Market Analysis

### Q: How does it compare to Discord and Slack?

**A**: In table form:

| Item | Anonymous Chat | Discord | Slack |
|------|----------------|---------|-------|
| Sign-up | ❌ | ✅ | ✅ |
| Message retention | **12 hours** | Forever | Forever |
| Channels | Unlimited | 500 per server | 1000 |
| File size | 100MB | 25MB (Free) / 50MB (Nitro) | 1GB |
| AI summary | ✅ (Workers AI) | ❌ | ✅ (Slack AI, paid) |
| Push notifications | ✅ | ✅ | ✅ |
| End-to-end encryption | ❌ | ❌ | ❌ |
| Price | **Free** (Cloudflare Free) | Free + paid | Free (recent usage limits) |
| PWA | ✅ | ✅ | ❌ |

**Differentiator**: "anonymous with no sign-up + automatic expiry" is missing from both products. But features like **search, permanent retention, and E2EE** are lacking.

---

### Q: What motivated a solo developer to build this much?

**A**: **(Personal answer section)**

Examples:
- "I was drawn to Cloudflare Workers and wanted to learn through a real project"
- "I wanted to see the potential of anonymous communities"
- "Portfolio differentiation (most projects are a React + Node.js combination)"

---

## Troubleshooting Cases

### Q: What was the hardest bug?

**A**: The **`sessionSecret` reuse bug** (already fixed).

Symptom: when a user reconnected the WS, a new secret should have been issued, but **messages signed with the old secret** kept arriving.

Cause: the client's `wsManager.disconnect()` didn't reset `this.sessionSecret = null`. On reconnect, the **old secret remained in use** until the handshake response arrived.

Fix:
```javascript
disconnect() {
  this.sessionSecret = null; // explicit reset
  this.heartbeat?.stop();
  if (this.ws) this.ws.close();
}
```

Today it's structurally hard to regress. Reconnection is only allowed via `join {sessionId, key}`; if the server's stored capability key doesn't match, it disconnects with **close 4401**. Both `secret` and `key` are rotated on every join.

---

### Q: How did you debug the Cloudflare D1 latency spikes?

**A**: Using **Workers Observability** + **Wrangler tail**.

```bash
wrangler tail --format=pretty --status=error
```

Logs showed:
- Many `D1_QUERY_FAIL` events → `audit_logs` table SELECTs taking 5s+
- Missing index confirmed → added `idx_audit_timestamp`
- Cached `await db.prepare(...).all()` results (1-minute TTL in KV)

D1 caps at **1,000 rows read/query**, so it slows down once 1,000+ audit logs accumulate. We therefore run retention separately — `audit_logs` 90 days / `admin_activity_logs` · `error_logs` 30 days / `security_events` 90 days (probabilistic cleanup). Migration 005 also replaced the non-deterministic strftime partial index on `security_events`. That index was a bug that **blocked every write** because SQLite forbids non-deterministic functions in indexes.

---

## License / Business

### Q: Why did you choose AGPL-3.0?

**A**:

1. **"Same freedom" principle** — if someone uses my code, they must open-source theirs too → keeps the open-source spirit
2. **Preserves a commercialization option** — with COMMERCIAL_LICENSE.md, businesses can pay to waive the AGPL obligations
3. **A common license in Korea** — though **MIT/Apache 2.0** is more common. AGPL is a somewhat "strong" license

For a school project submission, **MIT** is safer. To change the license you only need to edit wrangler.toml + the LICENSE file.

---

### Q: What if you operated this project as a SaaS?

**A**: **(Personal answer section)** — practically:

1. **Hobby Tier**: free (keep the current form)
2. **Pro Tier**:
   - Longer message retention (1 day/7 days/30 days)
   - Larger files (500MB/1GB)
   - Custom themes
3. **Enterprise**:
   - Custom domain + HSTS preload
   - SSO integration
   - 99.9% SLA

What's technically needed for monetization:
- Payment system (Stripe + Webhook)
- User DB (D1 → external Postgres)
- Email verification (SendGrid / Resend)

---

## Additional Interview Prep Questions

### Q: "Why do you want to join Cloudflare?" (Cloudflare-related question)

**A**: **(Personal answer section)** — based on what I felt building this project:

- Workers DX was great (wrangler CLI, wrangler.toml, binding abstraction)
- I experienced firsthand the potential of edge computing
- Durable Objects are a game changer (stateful serverless)

---

### Q: Where will this project be in 5 years?

**A**: **(Personal answer section)** — examples:

- If users grow → own domain + formal HSTS preload registration
- Technically → E2EE + mobile app
- Socially → I want it to become an example of "a healthy form of anonymous community"

---

**Created**: 2026-06-24  
**Related**: [PRESENTATION.en.md](./PRESENTATION.en.md)
