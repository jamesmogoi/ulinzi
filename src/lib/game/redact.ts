/*
  Runs on everything before it is stored. Players type their own details
  into a game about sending money, so anything that could identify them is
  replaced with a placeholder: phone numbers, emails, ID numbers, M-Pesa
  transaction codes, and card or account numbers. Numbers in `keep` (the
  game's fictional ones) stay, so the analysis can still tell the approved
  refund apart from everything else. Names can't be caught by a pattern,
  which is why the game asks players not to type them.

  One pass with one regex, so a number that is kept is never picked up
  again by a later pattern.
*/

import { normalizeKenyanPhone } from "./phone";

const PATTERNS = {
  email: String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`,
  // 0712 345 678, 0712.345.678, (0712) 345 678, +254 712 345 678, 712345678
  phone: String.raw`(?<![\d+])\(?(?:(?:\+?254|0)[\s.()-]*)?[17](?:[\s.()-]*\d){8}(?!\d)`,
  // M-Pesa codes: ten capitals and digits, starting with a letter, e.g. QJK7ABCD12
  mpesa: String.raw`\b(?=[A-Z0-9]{10}\b)[A-Z]+\d[A-Z0-9]*\b`,
  // Card and bank account numbers: 9 to 19 digits, grouped or not
  account: String.raw`(?<!\d)\d(?:[\s-]?\d){8,18}(?!\d)`,
  // Kenyan ID numbers are 7 or 8 digits. This also catches the odd
  // seven-figure amount, which is over the float anyway.
  id: String.raw`(?<!\d)\d{7,8}(?!\d)`,
} as const;

type Kind = keyof typeof PATTERNS;

const SENSITIVE = new RegExp(
  Object.entries(PATTERNS)
    .map(([kind, pattern]) => `(?<${kind}>${pattern})`)
    .join("|"),
  "g",
);

const PLACEHOLDER: Record<Kind, string> = {
  email: "<EMAIL>",
  phone: "<PHONE>",
  mpesa: "<MPESA_CODE>",
  account: "<NUMBER>",
  id: "<ID_NUMBER>",
};

export function redact(text: string, keep: ReadonlySet<string> = new Set()): string {
  return text.replace(SENSITIVE, (match, ...rest) => {
    const groups = rest.at(-1) as Record<Kind, string | undefined>;
    const kind = (Object.keys(PLACEHOLDER) as Kind[]).find((k) => groups[k] !== undefined) ?? "account";
    if (kind === "phone") {
      const msisdn = normalizeKenyanPhone(match);
      if (msisdn && keep.has(msisdn)) return match;
    }
    return PLACEHOLDER[kind];
  });
}
