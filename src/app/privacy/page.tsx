import type { Metadata } from "next";
import Link from "next/link";
import { ForgetButton } from "@/components/ForgetButton";
import { COUNTER_DAYS, RETENTION_DAYS } from "@/lib/server/store/types";

export const metadata: Metadata = {
  title: "Privacy · Mlinzi",
  description: "What Mlinzi keeps, why, who handles it, for how long, and how to delete it.",
};

/*
  Written against Kenya's Data Protection Act 2019 (the duty to notify, s.29):
  who collects, what, why, who else handles it, transfers outside Kenya,
  how long it is kept, and the player's rights. Every claim here is enforced
  in code: redaction in src/lib/game/redact.ts, retention in store.prune(),
  deletion in /api/forget.
*/

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-muted">{children}</div>
    </section>
  );
}

export default function Privacy() {
  const months = Math.round(RETENTION_DAYS / 30.4);
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6 md:py-12">
      <Link href="/" className="font-mono text-xs uppercase tracking-[0.2em] text-accent hover:underline">
        ← Back to the game
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-3 text-muted">
        Mlinzi is a game and a small research project by James Mogoi, a software engineer in Nairobi. There are no
        accounts, nothing is sold, and nothing is used for ads.
      </p>

      <Section title="What is kept">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Your messages to Mlinzi and his replies, after phone numbers, emails, ID numbers, M-Pesa codes and card or
            account numbers are removed. Names can&apos;t be removed automatically, so please don&apos;t type yours.
          </li>
          <li>The level you played, what happened, and the guard dog&apos;s score.</li>
          <li>
            A random game ID in a cookie on your device, the country your connection comes from, and a keyed hash of
            your IP address, used only for rate limits.
          </li>
        </ul>
      </Section>

      <Section title="Why">
        <p>
          To run the game, to stop one person using up everyone&apos;s free AI quota, and to study which tricks fool
          AI assistants in English, Swahili and Sheng. Findings are published as totals and redacted examples.
        </p>
      </Section>

      <Section title="Who handles it">
        <p>
          Your messages are sent to Groq, which runs the AI models, and stored with Neon, a database in Frankfurt. The
          site runs on Vercel. All three are outside Kenya.
        </p>
      </Section>

      <Section title="How long">
        <p>
          Messages are deleted once they are {months} months old. Rate-limit counters are deleted after {COUNTER_DAYS}{" "}
          days.
        </p>
      </Section>

      <Section title="Your choices">
        <p>
          Delete everything logged under this browser&apos;s game ID, right now. Your level progress stays on your
          device.
        </p>
        <ForgetButton />
        <p className="pt-2">
          For anything else, contact James through{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://mogoidev.vercel.app">
            mogoidev.vercel.app
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
