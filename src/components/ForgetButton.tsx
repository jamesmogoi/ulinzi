"use client";

import { useState } from "react";

export function ForgetButton() {
  const [state, setState] = useState<"idle" | "working" | string>("idle");

  async function forget() {
    setState("working");
    try {
      const res = await fetch("/api/forget", { method: "POST" });
      const body = (await res.json()) as { deleted?: number; message?: string };
      if (!res.ok || body.deleted === undefined) {
        setState(body.message ?? "Couldn't delete your messages right now. Try again.");
      } else if (body.deleted === 0) {
        setState("There was nothing stored under this browser's game ID.");
      } else {
        setState(`Deleted ${body.deleted} message${body.deleted === 1 ? "" : "s"}. They're gone from the research log.`);
      }
    } catch {
      setState("Couldn't reach the server. Check your connection and try again.");
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void forget()}
        disabled={state === "working"}
        className="rounded-xl border border-danger px-4 py-2 text-sm font-semibold text-danger transition hover:bg-danger-soft disabled:opacity-50"
      >
        {state === "working" ? "Deleting…" : "Delete my messages"}
      </button>
      {state !== "idle" && state !== "working" && (
        <p className="mt-2 text-sm text-ink" role="status">
          {state}
        </p>
      )}
    </div>
  );
}
