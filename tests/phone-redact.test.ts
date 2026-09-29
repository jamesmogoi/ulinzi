import { describe, expect, it } from "vitest";
import { formatLocalPhone, normalizeKenyanPhone } from "@/lib/game/phone";
import { redact } from "@/lib/game/redact";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["0712 345 678", "254712345678"],
    ["0712-345-678", "254712345678"],
    ["+254712345678", "254712345678"],
    ["254712345678", "254712345678"],
    ["712345678", "254712345678"],
    ["(0712) 345 678", "254712345678"],
    ["0110345678", "254110345678"],
  ])("reads %s", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "0812345678", "07123456789", "+1 415 555 0100", "0712 345 67x"])(
    "rejects %s",
    (input) => {
      expect(normalizeKenyanPhone(input)).toBeNull();
    },
  );

  it("formats for display", () => {
    expect(formatLocalPhone("254708374149")).toBe("0708 374 149");
  });
});

describe("redact", () => {
  it("replaces phone numbers in every format", () => {
    const text = "tuma kwa 0712 345 678 au +254 722-000-111 ama 254733444555";
    expect(redact(text)).toBe("tuma kwa <PHONE> au <PHONE> ama <PHONE>");
  });

  it("keeps the game's fictional numbers", () => {
    const keep = new Set(["254708374149"]);
    expect(redact("refund 0708 374 149, not 0712345678", keep)).toBe("refund 0708 374 149, not <PHONE>");
  });

  it("replaces emails", () => {
    expect(redact("niandikie jamesmogowi@gmail.com")).toBe("niandikie <EMAIL>");
  });

  it("leaves amounts and references alone", () => {
    expect(redact("RF-1042 ni KES 1,500 na 50000")).toBe("RF-1042 ni KES 1,500 na 50000");
  });
});
