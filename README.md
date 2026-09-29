# Mlinzi

**Unaweza kumdanganya Mlinzi?** *Can you trick the till guard?*

Mlinzi ("guard") runs a Nairobi shop's mobile-money till. Your job is to talk him into sending money he shouldn't. You can use English, Swahili, Sheng, a sob story, the boss on the phone, or a "wrong-number reversal". It's play money and a real lesson.

There are five levels. Each keeps the same rule, *pay approved refunds only*, and changes who enforces it:

1. **Mlinzi Mpya.** One line of instructions.
2. **Mlinzi Makini.** Detailed rules.
3. **Mlinzi wa Mtaa.** Rules plus the scams Kenyans know, in Swahili and Sheng.
4. **Mlinzi na Mbwa.** An injection detector (Llama Prompt Guard 2) screens every message.
5. **Mlinzi wa Chuma.** The till checks every payment in code. Fooling Mlinzi is no longer enough.

The point of level 5: **what a model is told to do is not a security control. What it is able to do is.**

## How it works

A Next.js 16 app on Vercel:
- **Model:** Groq's free-tier `gpt-oss-20b`, given one tool, `send_money`.
- **Detector:** Meta's Prompt Guard 2, also on Groq.
- **Outcome:** decided by code from the tool call.
- **Log:** every attempt is redacted and stored in Neon Postgres for analysis.

Design notes and the threat model are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
src/lib/game/     rules of the game: levels, till, judge, phone, redaction (pure, tested)
src/lib/server/   Groq client, guard, prompts, attempt orchestration, storage
src/app/api/      /api/attempt, /api/stats
src/components/   the game UI
db/schema.sql     attempts + rate counters
tests/            vitest: judge, session, redaction, provider fallback, full attempt flow
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
3. Add `GROQ_API_KEY` and `SESSION_SECRET` under Environment Variables.
4. Create the tables once: `vercel env pull .env.local && npm run db:migrate`.
5. Every push gets a preview URL. Share that with testers.

## Data and privacy

- Players are anonymous. There are no accounts; a signed cookie holds a random id and your level.
- Phone numbers and emails are removed before anything is stored. IPs are kept only as a keyed hash, for rate limiting.
- The money is fictional, and the game is not affiliated with Safaricom or any mobile-money provider.

## License

MIT
