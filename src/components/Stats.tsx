"use client";

import { useEffect, useState } from "react";
import { MAX_LEVEL } from "@/lib/game/levels";

type StatsData = {
  attempts: number;
  players: number;
  levels: { level: number; attempts: number; wins: number; fooled: number }[];
};

const count = new Intl.NumberFormat("en-KE");

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
      {count.format(stats.attempts)} attempts by {count.format(stats.players)} players
      {last && last.attempts > 0 && (
        <>
          {" "}
          · Level {MAX_LEVEL}: Mlinzi fooled {count.format(last.fooled)} times, money moved {count.format(last.wins)}
        </>
      )}
    </p>
  );
}
