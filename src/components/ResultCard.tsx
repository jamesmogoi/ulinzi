import type { ApiResponse, TransferView } from "@/lib/game/api";
import { MAX_LEVEL } from "@/lib/game/levels";

const kes = new Intl.NumberFormat("en-KE");

function money(transfer: TransferView): string {
  const amount = transfer.amountKes === null ? "an unknown amount" : `KES ${kes.format(transfer.amountKes)}`;
  return `${amount} to ${transfer.phone ?? "an invalid number"}`;
}

function Bubble({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-line bg-surface px-4 py-3 text-[15px] leading-relaxed">
      {text}
    </p>
  );
}

function Receipt({ tone, title, children }: { tone: "win" | "held" | "dog" | "plain"; title: string; children?: React.ReactNode }) {
  const tones = {
    win: "border-accent bg-accent-soft",
    held: "border-gold bg-gold-soft",
    dog: "border-danger bg-danger-soft",
    plain: "border-line bg-raised",
  } as const;
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <p className="font-mono text-sm font-medium">{title}</p>
      {children && <div className="mt-1 text-sm text-muted">{children}</div>}
    </div>
  );
}

function GuardNote({ score, active }: { score: number | null; active: boolean }) {
  if (score === null || active) return null;
  return (
    <p className="font-mono text-xs text-muted">
      Guard dog score {score.toFixed(2)}. It&apos;s asleep on this level; from level 4 it bites.
    </p>
  );
}

export function ResultCard({
  response,
  level,
  onNext,
}: {
  response: ApiResponse | null;
  level: number;
  onNext: () => void;
}) {
  if (response === null) {
    return (
      <p className="font-mono text-sm text-muted" aria-live="polite">
        Mlinzi is thinking…
      </p>
    );
  }

  if (response.status !== "played") {
    return <Receipt tone="plain" title={response.message} />;
  }

  const { outcome, reply, transfers, guardScore } = response;
  const guardActive = level >= 4;
  const unauthorized = transfers.find((t) => t.valid && !t.authorized);
  const approved = transfers.find((t) => t.authorized);

  return (
    <div className="space-y-2">
      {reply && <Bubble text={reply} />}

      {outcome === "transferred" && unauthorized && (
        <Receipt tone="win" title={`Pesa imetoka! Mlinzi sent ${money(unauthorized)}.`}>
          <p>Play money, real lesson: the model decided, and nothing checked it.</p>
          {level < MAX_LEVEL && (
            <button
              type="button"
              onClick={onNext}
              className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition hover:opacity-90"
            >
              Level {level + 1} unlocked. Go →
            </button>
          )}
        </Receipt>
      )}

      {outcome === "blocked_by_till" && unauthorized && (
        <Receipt tone="held" title={`Mlinzi tried to send ${money(unauthorized)}. The till said no.`}>
          <p>You fooled the model. The code held: it only pays approved refunds, whatever Mlinzi thinks.</p>
        </Receipt>
      )}

      {outcome === "approved_refund" && approved && (
        <Receipt tone="plain" title={`Mlinzi paid the approved refund: ${money(approved)}.`}>
          <p>That payment is allowed, so it doesn&apos;t count. Money has to go somewhere it shouldn&apos;t.</p>
        </Receipt>
      )}

      {outcome === "invalid_call" && (
        <Receipt tone="plain" title="Mlinzi reached for the till, but the number or amount was invalid.">
          <p>Payments need a Kenyan mobile number and a whole-shilling amount up to the float.</p>
        </Receipt>
      )}

      {outcome === "guard_blocked" && (
        <Receipt tone="dog" title={`Mbwa amebweka! The guard dog flagged your message (${guardScore?.toFixed(2)}).`}>
          <p>Mlinzi never saw it. The detector looks for attempts to override instructions.</p>
        </Receipt>
      )}

      {outcome === "garbled" && (
        <Receipt tone="plain" title="Mlinzi got tongue-tied and produced a broken payment. Try again." />
      )}

      {outcome === "refused" && !reply && <Receipt tone="plain" title="Mlinzi said nothing and paid nothing." />}

      <GuardNote score={guardScore} active={guardActive} />
    </div>
  );
}
