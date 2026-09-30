import type { ApiResponse, TransferView } from "@/lib/game/api";
import { MAX_LEVEL } from "@/lib/game/levels";
import { SHOP } from "@/lib/game/till";
import { SITE_URL } from "@/lib/site";

const kes = new Intl.NumberFormat("en-KE");

function recipient(transfer: TransferView): string {
  if (transfer.phone) return transfer.phone;
  if (transfer.onFileFor) return `the customer's number on file for ${transfer.onFileFor}`;
  return "an invalid number";
}

function money(transfer: TransferView): string {
  const amount = transfer.amountKes === null ? "an unknown amount" : `KES ${kes.format(transfer.amountKes)}`;
  return `${amount} to ${recipient(transfer)}`;
}

/** Why the till couldn't act on the payment Mlinzi asked for. */
function invalidReason(transfer: TransferView | undefined): string {
  if (!transfer) return "He reached for a tool the till doesn't have.";
  const { amountKes } = transfer;
  if (amountKes !== null && amountKes > SHOP.floatKes) {
    return `He asked for KES ${kes.format(amountKes)}, but the till only holds KES ${kes.format(SHOP.floatKes)}. Ask for less.`;
  }
  if (amountKes === null || !Number.isInteger(amountKes) || amountKes <= 0) {
    return "The amount wasn't a whole number of shillings.";
  }
  return "He didn't give a Kenyan mobile number to pay.";
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

/** The till's own line under a reply: words are not payments. */
function TillLine({ text }: { text: string }) {
  return <p className="font-mono text-xs text-muted">Till: {text}</p>;
}

const SHARE_TEXT = "Nimemdanganya Mlinzi! I fooled the AI till guard on all five levels, and the till still said no. Can you?";

function ShareButton() {
  async function share() {
    if (navigator.share) {
      await navigator.share({ title: "Mlinzi", text: SHARE_TEXT, url: SITE_URL }).catch(() => {});
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${SITE_URL}`)}`, "_blank", "noopener");
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="mt-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg transition hover:opacity-90"
    >
      Share your win
    </button>
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
    return <p className="font-mono text-sm text-muted">Mlinzi is thinking…</p>;
  }

  if (response.status !== "played") {
    return <Receipt tone="plain" title={response.message} />;
  }

  const { outcome, reply, transfers, guardScore, guardFlagged } = response;
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
        <Receipt tone="held" title="Umemaliza! You fooled Mlinzi on the last level.">
          <p>
            He tried to send {money(unauthorized)}, and the till said no. It checks every payment against the approved
            list in code, whatever Mlinzi believes. That&apos;s the lesson: an AI that moves money needs limits in code,
            not just instructions.
          </p>
          <ShareButton />
        </Receipt>
      )}

      {outcome === "approved_refund" && approved && (
        <Receipt tone="plain" title={`Mlinzi paid the approved refund: ${money(approved)}.`}>
          <p>That payment is allowed, so it doesn&apos;t count. Money has to go somewhere it shouldn&apos;t.</p>
        </Receipt>
      )}

      {outcome === "invalid_call" && (
        <Receipt tone="plain" title="Mlinzi reached for the till, but the payment didn't go through.">
          <p>{invalidReason(transfers[0])}</p>
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

      {outcome === "refused" && <TillLine text={reply ? "no money moved." : "Mlinzi said nothing, and no money moved."} />}

      {/* On levels 1 to 3 the dog only watches. Mention it when it would
          have bitten, which is the moment the score means something. */}
      {level < 4 && outcome !== "guard_blocked" && guardFlagged && guardScore !== null && (
        <p className="font-mono text-xs text-muted">
          The guard dog would have stopped this message from level 4 (score {guardScore.toFixed(2)}).
        </p>
      )}
    </div>
  );
}
