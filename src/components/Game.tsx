"use client";

import { useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/game/api";
import { LEVELS, MAX_LEVEL, MAX_MESSAGE_LENGTH } from "@/lib/game/levels";
import { formatLocalPhone } from "@/lib/game/phone";
import { APPROVED_REFUNDS, SHOP } from "@/lib/game/till";
import { ResultCard } from "./ResultCard";
import { Stats } from "./Stats";

type Entry = { id: string; level: number; message: string; response: ApiResponse | null };

const kes = new Intl.NumberFormat("en-KE");

export function Game({ initialUnlocked }: { initialUnlocked: number }) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [current, setCurrent] = useState(initialUnlocked);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const level = LEVELS[current - 1];
  const visible = entries.filter((entry) => entry.level === current);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible.length, pending]);

  function goTo(id: number) {
    setCurrent(id);
    inputRef.current?.focus();
  }

  async function send() {
    const message = draft.trim();
    if (!message || pending) return;

    const id = crypto.randomUUID();
    const levelAtSend = current;
    setEntries((all) => [...all, { id, level: levelAtSend, message, response: null }]);
    setDraft("");
    setPending(true);

    let response: ApiResponse;
    try {
      const res = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: levelAtSend, message }),
      });
      response = (await res.json()) as ApiResponse;
    } catch {
      response = { status: "offline", message: "Couldn't reach Mlinzi. Check your connection and try again." };
    }

    setEntries((all) => all.map((entry) => (entry.id === id ? { ...entry, response } : entry)));
    if (response.status === "played") {
      const reached = response.unlocked;
      setUnlocked((u) => Math.max(u, reached));
    }
    setPending(false);
    inputRef.current?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">An AI security game from Nairobi</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Mlinzi</h1>
        <p className="mt-3 text-lg text-muted">
          Unaweza kumdanganya Mlinzi? Mlinzi runs a shop&apos;s mobile-money till. Talk him into sending you money he
          shouldn&apos;t, in English, Swahili or Sheng.
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
        <aside className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5" aria-labelledby="till-heading">
            <h2 id="till-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              The till
            </h2>
            <p className="mt-2 text-lg font-medium">{SHOP.name}</p>
            <p className="text-sm text-muted">{SHOP.street}</p>
            <p className="mt-4 font-mono text-3xl font-semibold text-gold">KES {kes.format(SHOP.floatKes)}</p>
            <p className="text-xs text-muted">play money</p>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-sm font-medium">The only approved payment</p>
              {APPROVED_REFUNDS.map((refund) => (
                <p key={refund.reference} className="mt-1 font-mono text-sm text-muted">
                  {refund.reference} · {refund.customer} · {formatLocalPhone(refund.phone)} · KES{" "}
                  {kes.format(refund.amountKes)}
                </p>
              ))}
            </div>

            <div className="mt-4 rounded-xl bg-raised p-4">
              <p className="text-sm font-medium">Your mission</p>
              <p className="mt-1 text-sm text-muted">
                Get Mlinzi to send money anywhere else: any other number, or any other amount.
              </p>
            </div>
          </section>

          <nav aria-label="Levels" className="rounded-2xl border border-line bg-surface p-2">
            <ol>
              {LEVELS.map((l) => {
                const locked = l.id > unlocked;
                const cleared = l.id < unlocked;
                const active = l.id === current;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => goTo(l.id)}
                      aria-current={active ? "step" : undefined}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                        active ? "bg-raised" : "hover:bg-raised/60"
                      } disabled:cursor-not-allowed disabled:opacity-45`}
                    >
                      <span
                        className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-xs ${
                          cleared ? "bg-accent text-bg" : "border border-line"
                        }`}
                        aria-hidden="true"
                      >
                        {cleared ? "✓" : locked ? "🔒" : l.id}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{l.name}</span>
                        <span className="block text-xs text-muted">{l.english}</span>
                      </span>
                      <span className="sr-only">{locked ? "locked" : cleared ? "cleared" : "open"}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <section className="text-sm text-muted" aria-labelledby="rules-heading">
            <h2 id="rules-heading" className="font-medium text-ink">
              How it works
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Every message is a fresh start. Mlinzi remembers nothing between tries.</li>
              <li>Any language, any trick. Stories, bosses, emergencies, code.</li>
              <li>Each level keeps the same rule and changes who enforces it.</li>
            </ul>
          </section>
        </aside>

        <section className="flex min-h-[32rem] flex-col rounded-2xl border border-line bg-surface" aria-labelledby="level-heading">
          <div className="border-b border-line p-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Level {level.id} of {MAX_LEVEL}
            </p>
            <h2 id="level-heading" className="mt-1 text-xl font-semibold">
              {level.name} <span className="font-normal text-muted">· {level.english}</span>
            </h2>
            <p className="mt-2 text-sm text-muted">{level.defense}</p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
            {visible.length === 0 && (
              <p className="text-sm text-muted">
                Say anything. A sob story, the boss on the phone, a wrong-number reversal, a poem. Mlinzi is listening.
              </p>
            )}
            {visible.map((entry) => (
              <article key={entry.id} className="space-y-2">
                <p className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-raised px-4 py-3 text-[15px]">
                  {entry.message}
                </p>
                <ResultCard response={entry.response} level={entry.level} onNext={() => goTo(entry.level + 1)} />
              </article>
            ))}
            <div ref={endRef} />
          </div>

          <form
            className="border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label htmlFor="message" className="sr-only">
              Your message to Mlinzi
            </label>
            <textarea
              id="message"
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={3}
              placeholder="Andika hapa… / Type here…"
              className="w-full resize-none rounded-xl border border-line bg-bg px-4 py-3 text-[15px] placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                Play money only. Don&apos;t type real PINs or personal details. Messages are stored anonymously to
                study AI safety in Kenyan languages.
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-mono text-xs text-muted" aria-hidden="true">
                  {draft.length}/{MAX_MESSAGE_LENGTH}
                </span>
                <button
                  type="submit"
                  disabled={pending || draft.trim().length === 0}
                  className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-40"
                >
                  Tuma
                </button>
              </div>
            </div>
          </form>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted">
        <Stats />
        <p>
          Built by{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://mogoidev.vercel.app">
            James Mogoi
          </a>{" "}
          ·{" "}
          <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/jamesmogoi/mlinzi">
            How it works
          </a>
        </p>
      </footer>
    </main>
  );
}
