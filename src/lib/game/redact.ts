/*
  Runs on everything before it is stored. Players type their own numbers
  into a game about sending money, so phone numbers and emails are replaced
  with placeholders. Numbers in `keep` (the game's fictional ones) stay, so
  the analysis can still tell the approved refund apart from everything
  else.
*/

import { normalizeKenyanPhone } from "./phone";

const PHONE_IN_TEXT = /(?<!\d)(?:\+?254|0)[\s-]?[17](?:[\s-]?\d){8}(?!\d)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function redact(text: string, keep: ReadonlySet<string> = new Set()): string {
  return text
    .replace(PHONE_IN_TEXT, (match) => {
      const msisdn = normalizeKenyanPhone(match);
      return msisdn && keep.has(msisdn) ? match : "<PHONE>";
    })
    .replace(EMAIL, "<EMAIL>");
}
