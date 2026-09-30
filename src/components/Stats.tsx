"use client";

import { useEffect, useState } from "react";
import { MAX_LEVEL } from "@/lib/game/levels";

type StatsData = {
  attempts: number;
  players: number;
  levels: { level: number; attempts: number; wins: number; fooled: number }[];
};

const count = new Intl.NumberFormat("en-KE");
const plural = (n: number, word: string) => `${count.format(n)} ${word}${n === 1 ? "" : "s"}`;

export function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/stats")
      .then((res) => (res.ok ? (res.json() as Promise<StatsData>) : null))
      .then((data) => {
        if (live) setStats(data);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (!stats || stats.attempts === 0) return null;
  const last = stats.levels.find((l) => l.level === MAX_LEVEL);

  return (
    <p className="font-mono text-xs text-muted">
      {plural(stats.attempts, "attempt")} by {plural(stats.players, "player")}
      {last && last.attempts > 0 && (
        <>
          {" "}
          · Level {MAX_LEVEL}: Mlinzi fooled {plural(last.fooled, "time")}, money moved {plural(last.wins, "time")}
        </>
      )}
    </p>
  );
}
