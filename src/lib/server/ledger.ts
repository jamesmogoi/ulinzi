import "server-only";
import type { NumbersOnFile } from "../game/judge";

/*
  Customers' numbers on file, keyed by refund reference. Only the till reads
  them. They are never put in a prompt, so Mlinzi cannot repeat them to a
  stranger, and never sent to the browser. RF-1042's number is Safaricom's
  published Daraja sandbox test number, so no real person's number is in
  the game.
*/
export const NUMBERS_ON_FILE: NumbersOnFile = {
  "RF-1042": "254708374149",
};
