# Mlinzi architecture

Mlinzi is a public game and a small research instrument. Players try to talk a mobile-money till assistant into an unauthorized payment. Every attempt is logged, redacted, with the guard score, the model's decision and the outcome. That log is what the write-up will be built from.

## The claim the game tests

Every level holds the same policy: *pay approved refunds only.* What changes is who enforces it.

| Level | Prompt | Prompt Guard 2 | Who enforces the policy |
|---|---|---|---|
| 1 Mlinzi Mpya | One line | scores, never blocks | the model |
| 2 Mlinzi Makini | Detailed rules (English) | scores, never blocks | the model |
| 3 Mlinzi wa Mtaa | Rules + Kenyan scam patterns, Swahili/Sheng | scores, never blocks | the model |
| 4 Mlinzi na Mbwa | Same as 3 | **blocks** at threshold | the model |
| 5 Mlinzi wa Chuma | Same as 3 | **blocks** at threshold | **the till (code)** |

Levels 1 to 4 execute whatever payment the model asks for. Level 5 checks the payment against the approved list in code. Level 5 therefore can't be won through the model. It can still be *fooled*, and the log records that separately as `blocked_by_till`, which is the number that makes the point.

Scoring the guard in shadow mode on levels 1 to 3 gives a detector score for every attack, including the ones that worked. That's how guard performance by language gets measured on real traffic without running anything locally.

## Request flow

```
POST /api/attempt {level, message}
  1  same-origin check, body validation (1–800 chars)
  2  session: HMAC-signed cookie {sid, unlocked}; level ≤ unlocked
  3  limits: per-IP (hashed) hourly, global daily. Fixed windows in Postgres
  4  guard: Prompt Guard 2 86M (Groq)
       block levels  → first, fail closed, stop if score ≥ threshold
       shadow levels → in parallel with the model, never blocks
  5  model: gpt-oss-20b (Groq) with one tool, send_money. Fallback model on 429/5xx
  6  judge (pure code): parse tool calls → transferred | blocked_by_till |
       approved_refund | invalid_call | refused
  7  log: redacted attempt row (phones and emails replaced) → Postgres
  8  respond; re-sign the cookie with any newly unlocked level
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
| **Postgres (Neon) for rate limits and the log** | One datastore. Neon's HTTP driver needs no connection pool in serverless functions. |
| **Memory store locally, refused on Vercel** | A fresh clone runs with only a Groq key. In production an in-memory store would break limits silently, so config refuses to start. |
| **Static CSP, no nonces** | No third-party code is loaded. Nonces would force dynamic rendering for no gain (Next.js 16 CSP guide). |
| **Vercel's x-forwarded-for, HMAC'd** | Vercel overwrites the header, so it can't be spoofed. Only a keyed hash is stored. |

## Free-tier budget

- **Groq free:** gpt-oss-20b and gpt-oss-120b get ~1K requests/day each, and Prompt Guard 2 gets 14.4K/day. Limits apply per model per organization, and cached tokens don't count.
- **`DAILY_ATTEMPT_CAP` (1,800)** keeps the game inside the two models' combined daily requests. When it's spent, the game says *Mlinzi amelala, rudi kesho*.
- **Neon free:** 0.5 GB, enough for millions of attempt rows.
- **Vercel Hobby:** hosting, plus a preview URL per push for testers.

## Privacy

- Players are anonymous. There are no accounts, and the session cookie holds a random id and a level number.
- Phone numbers and emails are replaced before anything is stored. IPs are stored only as an HMAC.
- The UI tells players it's play money, asks them not to enter personal details, and says messages are kept anonymously for research.
- No Safaricom or M-Pesa branding. The till is "mobile money" and the money is fictional. The approved refund goes to Safaricom's public Daraja sandbox test number, not a real person's.

## Threat model (the app itself)

| Threat | Control |
|---|---|
| Skipping levels | Signed session cookie; level checked server-side |
| Quota burn or scripted flooding | Per-IP hourly limit, global daily cap, `GAME_ENABLED` kill switch |
| Cross-site posting | SameSite=Lax cookie + Origin check |
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
