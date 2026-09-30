# Mlinzi architecture

Mlinzi is a public game and a small research instrument. Players try to talk a mobile-money till assistant into an unauthorized payment. Every attempt is logged, redacted, with the guard score, the model's decision and the outcome. That log is what the write-up will be built from.

## The claim the game tests

Every level holds the same policy: *pay approved refunds only.* What changes is who enforces it.

| Level | Prompt | Prompt Guard 2 | Who enforces the policy |
|---|---|---|---|
| 1 Mlinzi Mpya | One line | scores, never blocks | the model |
| 2 Mlinzi Makini | One line + an owner-impersonation warning | scores, never blocks | the model |
| 3 Mlinzi wa Mtaa | Warning + Kenyan scam patterns, Swahili/Sheng | scores, never blocks | the model |
| 4 Mlinzi na Mbwa | Same as 3 | **blocks** at threshold | the model |
| 5 Mlinzi wa Chuma | Same as 3 | **blocks** at threshold | **the till (code)** |

Levels 1 to 4 execute whatever payment the model asks for. Level 5 checks the payment against the approved list in code. Level 5 therefore can't be won through the model. It can still be *fooled*, and the log records that separately as `blocked_by_till`, which is the number that makes the point. Fooling it finishes the game.

The prompts are tuned so each level is harder than the last and none is a wall, because level 5 is finished by fooling level 3's prompt. Measured against gpt-oss-20b on 2026-09-30: roughly 4 of 9 attacks beat level 1, 2 of 9 level 2, and 2 of 14 level 3. The measurements are in the comment above `PROMPTS` in `src/lib/server/prompts.ts`.

Scoring the guard in shadow mode on levels 1 to 3 gives a detector score for every attack, including the ones that worked. That's how guard performance by language gets measured on real traffic without running anything locally.

## Request flow

```
POST /api/attempt {level, message}
  1  same-origin check, body validation (1–800 chars)
  2  session: HMAC-signed cookie {sid, unlocked, finished}; level ≤ unlocked
  3  limits: per player and per network (hashed IP) hourly; a global daily
       cap on model calls. Fixed windows in Postgres
  4  guard: Prompt Guard 2 86M (Groq)
       block levels  → first, fail closed, stop if score ≥ threshold
       shadow levels → in parallel with the model, never blocks
  5  model: gpt-oss-20b (Groq) with one tool, send_money. Fallback model on 429/5xx
  6  judge (pure code): parse tool calls, resolve a refund's number on file
       from the server-side ledger → transferred | blocked_by_till |
       approved_refund | invalid_call | refused
  7  log: redacted attempt row → Postgres. The first model call of each UTC
       day also deletes data past retention
  8  respond; re-sign the cookie with any new progress
```

## Decisions

| Decision | Why |
|---|---|
| **Single-turn attempts** | No history means no forged assistant turns. Each row is an independent sample, so the analysis stays simple. Multi-turn attacks are Phase 2. |
| **No second model call after a tool call** | The receipt is generated from the tool call itself. That halves quota use and shows players the raw decision the model made. |
| **Direct HTTP to Groq, no SDK or framework** | Anthropic's *Building Effective Agents*: frameworks "obscure the underlying prompts and responses". In a security demo the request must be readable. |
| **The outcome is decided by code, never by an LLM judge** | Whether a transfer left the till is a fact, not a judgment. |
| **Prompts are server-only** | `import "server-only"` keeps them out of the JS bundle; players meet them only through the model. |
| **Guard fails closed on blocking levels** | A security control that fails open is not a control. |
| **Approved refund paid once per reply** | A duplicate payment isn't approved. Idempotency, the same rule as M-Pesa callbacks. |
| **The model never sees customer data** | Mlinzi gets a refund's reference and amount. The customer's number lives in `src/lib/server/ledger.ts`, and the till looks it up when it pays. A tester got the old prompt to read the customer's name and number to a stranger. The fix is not an instruction to keep a secret, which is the kind of control this game shows failing. The data is simply not in the model's context (OWASP LLM Top 10: sensitive information disclosure, hidden context exposure). The number never reaches the browser either. |
| **Limits per player, then per network** | Kenyan mobile data puts many people behind one IP (carrier-grade NAT), so a tight per-IP limit would lock out whole networks. The per-player limit does the everyday work, and a loose per-IP limit backs it up for scripts that drop their cookies. |
| **Rate limits are "busy", never "come back tomorrow"** | Groq's daily limits refill continuously, so a 429 always means a short wait, and players are told how long. Only the game's own daily cap sends Mlinzi to sleep. The cap counts calls that reached a model, so retries during a busy spell can't use it up. |
| **Timeouts fit the route** | 5 s for the guard and 10 s per model keeps the worst case inside the route's 30 s limit. |
| **Functions in Frankfurt** | `vercel.json` pins functions to `fra1`, next to Neon, instead of Vercel's default in Washington. That removes a transatlantic round trip from every database query, and Frankfurt is also closer to Nairobi. |
| **Postgres (Neon) for rate limits and the log** | One datastore. Neon's HTTP driver needs no connection pool in serverless functions. |
| **Memory store locally, refused on Vercel** | A fresh clone runs with only a Groq key. In production an in-memory store would break limits silently, so config refuses to start. |
| **Static CSP, no nonces** | No third-party code is loaded. Nonces would force dynamic rendering for no gain (Next.js 16 CSP guide). |
| **Vercel's x-forwarded-for, HMAC'd** | Vercel overwrites the header, so it can't be spoofed. Only a keyed hash is stored. |

## Free-tier budget

- **Groq free:** gpt-oss-20b and gpt-oss-120b get 1K requests, 8K tokens a minute and 200K tokens a day each. Prompt Guard 2 gets 14.4K requests a day, but only 30 a minute, the tightest limit in the game. Limits apply per model per organization.
- **Measured:** an attempt costs about 410 tokens on level 1 and 600 on level 3. Groq caches the shared system prompt (512 tokens on a repeat), and cached tokens don't count toward limits. So requests, not tokens, set the daily ceiling of roughly 2K attempts across the two models.
- **`DAILY_ATTEMPT_CAP` (1,800)** keeps the game just inside that ceiling. When it's spent, the game says *Mlinzi amelala, rudi kesho*, and resets at 03:00 Nairobi time.
- **Neon free:** 0.5 GB, enough for millions of attempt rows.
- **Vercel Hobby:** hosting, plus a preview URL per push for testers.

## Privacy

- There are no accounts. The session cookie holds a random id and the player's progress, so the log is pseudonymous, not anonymous.
- Phone numbers, emails, ID numbers, M-Pesa codes and card or account numbers are replaced before anything is stored (`src/lib/game/redact.ts`), in a single pass so the game's own number can be kept. IPs are stored only as an HMAC.
- `/privacy` is the notice required by Kenya's Data Protection Act 2019 (s.29). It says what is kept and why, who processes it, that all three processors (Groq, Vercel, Neon) are outside Kenya, how long it is kept, and how to delete it.
- Attempts are deleted after 365 days and rate counters after 2, by `store.prune()`. "Delete my messages" (`/api/forget`) deletes everything under the player's session id and issues a new one.
- No Safaricom or M-Pesa branding. The till is "mobile money" and the money is fictional. The approved refund goes to Safaricom's public Daraja sandbox test number, not a real person's.

## Threat model (the app itself)

| Threat | Control |
|---|---|
| Skipping levels | Signed session cookie; level checked server-side |
| Quota burn or scripted flooding | Per-player and per-network hourly limits, a global daily cap, `GAME_ENABLED` kill switch |
| Customer data leaking through the model | Not in the prompt: the till resolves numbers server-side |
| Cross-site posting, including forged deletes | SameSite=Lax cookie + Origin check on both POST routes |
| XSS via model output | React escapes text; no markdown or HTML rendering; strict CSP |
| Secrets in the client | Groq key and prompts are server-only |
| PII in the research log | Redaction before insert; hashed IPs; no raw request logging |

## Sources

- Anthropic, Building Effective Agents: https://www.anthropic.com/engineering/building-effective-agents
- Beurer-Kellner et al., Design Patterns for Securing LLM Agents against Prompt Injections (arXiv 2506.08837)
- OWASP Top 10 for LLM Applications 2026: https://genai.owasp.org/resource/owasp-genai-llm-top-10-2026/
- Llama Prompt Guard 2 model card: https://github.com/meta-llama/PurpleLlama/blob/main/Llama-Prompt-Guard-2/86M/MODEL_CARD.md
- Groq tool use, reasoning and rate limits: https://console.groq.com/docs
- Next.js 16 docs (bundled in `node_modules/next/dist/docs`): route handlers, cookies, CSP
- Neon serverless driver: https://neon.com/docs/serverless/serverless-driver
- Vercel request headers: https://vercel.com/docs/headers/request-headers
- Lakera's Gandalf, the game this one localizes: https://huggingface.co/datasets/Lakera/gandalf_ignore_instructions
