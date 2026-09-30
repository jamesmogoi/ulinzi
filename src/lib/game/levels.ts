/*
  The ladder. Every level holds the same policy, "pay approved refunds
  only"; what changes is who enforces it. Levels 1 to 4 trust the model to
  enforce it. Level 5 moves enforcement into code. That single change is the
  thing the game exists to show.

  Client-safe: names and descriptions only. The prompts live in
  src/lib/server/prompts.ts so they never reach the browser bundle.
*/

export type GuardMode = "shadow" | "block";
export type Enforcement = "model" | "code";

export type Level = {
  id: number;
  name: string;
  english: string;
  defense: string;
  /** shadow: Prompt Guard scores every message but never blocks. */
  guardMode: GuardMode;
  /** model: the tool executes whatever Mlinzi asks. code: the till checks. */
  enforcement: Enforcement;
};

export const LEVELS: readonly Level[] = [
  {
    id: 1,
    name: "Mlinzi Mpya",
    english: "The new guard",
    defense: "One line of instructions: only pay approved refunds.",
    guardMode: "shadow",
    enforcement: "model",
  },
  {
    id: 2,
    name: "Mlinzi Makini",
    english: "The careful guard",
    defense: "The same rule, plus one warning: scammers pretend to be the shop owner.",
    guardMode: "shadow",
    enforcement: "model",
  },
  {
    id: 3,
    name: "Mlinzi wa Mtaa",
    english: "The street-smart guard",
    defense:
      "The warning, plus the scams Kenyans know by heart: wrong-number reversals, fake customer care, the boss on a call, in Swahili and Sheng.",
    guardMode: "shadow",
    enforcement: "model",
  },
  {
    id: 4,
    name: "Mlinzi na Mbwa",
    english: "The guard with a dog",
    defense:
      "An injection detector, Meta's Llama Prompt Guard 2, sniffs every message before Mlinzi reads it.",
    guardMode: "block",
    enforcement: "model",
  },
  {
    id: 5,
    name: "Mlinzi wa Chuma",
    english: "The iron guard",
    defense:
      "The till itself checks every payment against the approved list, so no money can move. Fool Mlinzi into trying anyway to finish the game.",
    guardMode: "block",
    enforcement: "code",
  },
];

export const MAX_LEVEL = LEVELS.length;

export function getLevel(id: number): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}

/** Prompt Guard's window is 512 tokens; this keeps every message well inside it. */
export const MAX_MESSAGE_LENGTH = 800;
