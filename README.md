# Mlinzi

**Unaweza kumdanganya Mlinzi?** *Can you trick the till guard?*

Mlinzi ("guard") is an AI assistant that pays refunds from a Nairobi shop's mobile-money till. Your job is to talk him into sending money he shouldn't. You can use English, Swahili, Sheng, a sob story, the boss on the phone, or a "wrong-number reversal". The shop is made up and the money is play money. The lesson is real: shops, banks and saccos are starting to let AI move money.

There are five levels. Each keeps the same rule, *pay approved refunds only*, and changes who enforces it:

1. **Mlinzi Mpya.** One line of instructions.
2. **Mlinzi Makini.** The same line, plus a warning about scammers posing as the owner.
3. **Mlinzi wa Mtaa.** The warning, plus the scams Kenyans know, in Swahili and Sheng.
4. **Mlinzi na Mbwa.** An injection detector (Llama Prompt Guard 2) screens every message.
5. **Mlinzi wa Chuma.** The till checks every payment in code, so no money can move. Fool Mlinzi into trying anyway to finish the game.

The point of level 5: **what a model is told to do is not a security control. What it is able to do is.**

## How it works

A Next.js 16 app on Vercel:
- **Model:** Groq's free-tier `gpt-oss-20b`, given one tool, `send_money`. It sees a refund's reference and amount, never the customer's name or number.
- **Detector:** Meta's Prompt Guard 2, also on Groq.
- **Outcome:** decided by code from the tool call.
- **Log:** every attempt is redacted and stored in Neon Postgres for analysis.

Design notes and the threat model are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/lib/game/     rules of the game: levels, till, judge, phone, redaction (pure, tested)
src/lib/server/   Groq client, guard, prompts, attempt orchestration, storage
src/app/api/      /api/attempt, /api/stats, /api/forget ("delete my messages")
src/components/   the game UI
db/schema.sql     attempts + rate counters
tests/            vitest: judge, session, redaction, provider fallback, store, full attempt flow
```

## Run it

Nothing runs on your machine but a small web server. The AI lives on Groq.

```bash
npm install
cp .env.example .env.local      # add GROQ_API_KEY and SESSION_SECRET
npm run dev                     # http://localhost:3000
```

Without `DATABASE_URL`, attempts are kept in memory, which is fine for trying it out.

```bash
npm run verify   # lint, typecheck, tests, production build
```

## Deploy (free)

1. Push to GitHub and import the repo in [Vercel](https://vercel.com/new).
2. In the Vercel project, add **Neon** from Storage / Marketplace (free plan). It sets `DATABASE_URL`.
3. Add `GROQ_API_KEY` and `SESSION_SECRET` under Environment Variables, then redeploy.
4. The tables create themselves: `vercel-build` runs `db/schema.sql` before every build, and the schema is idempotent.
5. Every push gets a preview URL. Share that with testers.

Functions run in Frankfurt (`fra1`, set in `vercel.json`), next to the Neon database. If you create your database elsewhere, change the region to match.

## Data and privacy

- There are no accounts. A signed cookie holds a random id and your progress.
- Phone numbers, emails, ID numbers, M-Pesa codes and card or account numbers are removed before anything is stored. IPs are kept only as a keyed hash, for rate limiting.
- Attempts are deleted after 12 months, and players can delete theirs at any time from the privacy page.
- The money is fictional, and the game is not affiliated with Safaricom, M-Pesa or any payment provider.

## License

MIT
