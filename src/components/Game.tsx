"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ApiResponse } from "@/lib/game/api";
import { LEVELS, MAX_LEVEL, MAX_MESSAGE_LENGTH } from "@/lib/game/levels";
import { APPROVED_REFUNDS, SHOP } from "@/lib/game/till";
import { ResultCard } from "./ResultCard";
import { Stats } from "./Stats";

type Entry = { id: string; level: number; message: string; response: ApiResponse | null };

const kes = new Intl.NumberFormat("en-KE");

// Phones get the on-screen keyboard's Enter for new lines and a tap on
// Tuma to send, and the keyboard isn't popped back up over each reply.
const finePointer = () => window.matchMedia("(pointer: fine)").matches;

export function Game({ initialUnlocked, initialFinished }: { initialUnlocked: number; initialFinished: boolean }) {
  const [unlocked, setUnlocked] = useState(initialUnlocked);
  const [finished, setFinished] = useState(initialFinished);
  const [current, setCurrent] = useState(initialUnlocked);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const level = LEVELS[current - 1];
  const visible = entries.filter((entry) => entry.level === current);

  useEffect(() => {
    // Nothing to show yet: don't scroll the page away from the top on load.
    if (visible.length === 0 && !pending) return;
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible.length, pending]);

  function goTo(id: number) {
    setCurrent(id);
    if (finePointer()) inputRef.current?.focus();
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
      // A platform timeout answers with an HTML page, not JSON.
      response = await res
        .json()
        .catch((): ApiResponse => ({ status: "unavailable", message: "Mlinzi took too long to answer. Try again." }));
    } catch {
      response = { status: "offline", message: "Couldn't reach Mlinzi. Check your connection and try again." };
    }

    setEntries((all) => all.map((entry) => (entry.id === id ? { ...entry, response } : entry)));
    if (response.status === "played") {
      const { unlocked: reached, finished: won } = response;
      setUnlocked((u) => Math.max(u, reached));
      if (won) setFinished(true);
    }
    setPending(false);
    if (finePointer()) inputRef.current?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-6 md:py-12">
      <header className="max-w-2xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">An AI security game from Nairobi</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">Mlinzi</h1>
        <p className="mt-3 text-base text-muted md:text-lg">
          <span lang="sw">Unaweza kumdanganya Mlinzi?</span> He&apos;s an AI assistant that pays refunds from a
          shop&apos;s mobile-money till. Talk him into sending you money he shouldn&apos;t, in English, Swahili or
          Sheng.
        </p>
        <p className="mt-3 text-sm text-muted">
          <strong className="font-medium text-ink">It&apos;s a game:</strong> the shop is made up, the money is play
          money, and nothing connects to M-Pesa or a bank. The point is real. Shops, banks and saccos are starting to
          let AI move money, and each level adds a defence real teams use, so you can see which ones actually stop a
          scam.
        </p>
      </header>

      {/* One column on phones, in the order a player needs: the brief, the
          chat, then the level list. Two columns from lg, the chat on the
          right. The last left row takes the slack, so a long chat never
          spreads the left-hand cards apart. */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_auto_1fr] lg:items-start">
        <section
          className="rounded-2xl border border-line bg-surface p-4 md:p-5 lg:col-start-1 lg:row-start-1"
          aria-labelledby="till-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="till-heading" className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              The till
            </h2>
            <span className="rounded-full border border-gold px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-gold">
              Play money
            </span>
          </div>
          <p className="mt-2 text-lg font-medium">{SHOP.name}</p>
          <p className="text-sm text-muted">{SHOP.street}</p>
          <p className="mt-3 font-mono text-3xl font-semibold text-gold">KES {kes.format(SHOP.floatKes)}</p>

          <div className="mt-4 border-t border-line pt-4">
            <p className="text-sm font-medium">The only approved payment</p>
            {APPROVED_REFUNDS.map((refund) => (
              <p key={refund.reference} className="mt-1 font-mono text-sm text-muted">
                {refund.reference} · KES {kes.format(refund.amountKes)} · to the customer&apos;s number on file
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

        <section
          className="flex flex-col rounded-2xl border border-line bg-surface lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:min-h-[32rem]"
          aria-labelledby="level-heading"
        >
          <div className="border-b border-line p-4 md:p-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
              Level {level.id} of {MAX_LEVEL}
            </p>
            <h2 id="level-heading" className="mt-1 text-xl font-semibold">
              <span lang="sw">{level.name}</span> <span className="font-normal text-muted">· {level.english}</span>
            </h2>
            <p className="mt-2 text-sm text-muted">{level.defense}</p>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-5" aria-live="polite">
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
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing && finePointer()) {
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
                Play money only. Please don&apos;t type your name or personal details: messages are kept for research,
                with numbers removed.{" "}
                <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
                  Privacy
                </Link>
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

        <nav aria-label="Levels" className="rounded-2xl border border-line bg-surface p-2 lg:col-start-1 lg:row-start-2">
          <ol>
            {LEVELS.map((l) => {
              const locked = l.id > unlocked;
              const cleared = l.id < unlocked || (l.id === MAX_LEVEL && finished);
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
                      <span className="block text-sm font-medium" lang="sw">
                        {l.name}
                      </span>
                      <span className="block text-xs text-muted">{l.english}</span>
                    </span>
                    <span className="sr-only">{locked ? "locked" : cleared ? "cleared" : "open"}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <section className="text-sm text-muted lg:col-start-1 lg:row-start-3" aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="font-medium text-ink">
            How it works
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Every message is a fresh start. Mlinzi remembers nothing between tries.</li>
            <li>Any language, any trick. Stories, bosses, emergencies, code.</li>
            <li>Each level keeps the same rule and changes who enforces it.</li>
          </ul>
        </section>
      </div>

      <footer className="mt-10 space-y-3 border-t border-line pt-6 text-xs text-muted">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Stats />
          <p>
            Built by{" "}
            <a className="underline underline-offset-2 hover:text-ink" href="https://mogoidev.vercel.app">
              James Mogoi
            </a>{" "}
            ·{" "}
            <a className="underline underline-offset-2 hover:text-ink" href="https://github.com/jamesmogoi/ulinzi">
              Source code
            </a>{" "}
            ·{" "}
            <Link className="underline underline-offset-2 hover:text-ink" href="/privacy">
              Privacy
            </Link>
          </p>
        </div>
        <p>Play money only. Not affiliated with Safaricom, M-Pesa or any payment provider.</p>
      </footer>
    </main>
  );
}
