/*
  Kenyan mobile numbers, in every shape people type them: 0712 345 678,
  0712-345-678, +254712345678, 254712345678, and the newer 01xx range.
  Everything is reduced to one canonical form, 2547XXXXXXXX or
  2541XXXXXXXX, so a transfer check can never be dodged by formatting.
*/

const SEPARATORS = /[\s\-().]/g;
const KENYAN_MOBILE = /^(?:\+?254|0)?([17]\d{8})$/;

export function normalizeKenyanPhone(input: string): string | null {
  const match = KENYAN_MOBILE.exec(input.replace(SEPARATORS, ""));
  return match ? `254${match[1]}` : null;
}

/** 254708374149 -> "0708 374 149" */
export function formatLocalPhone(msisdn: string): string {
  const local = `0${msisdn.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
