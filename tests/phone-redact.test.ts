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

  it.each([
    ["dots", "piga 0712.345.678"],
    ["brackets", "piga (0712) 345 678"],
    ["no prefix", "piga 712345678"],
    ["the newer 01 range", "piga 0110 345 678"],
  ])("replaces phone numbers written with %s", (_label, text) => {
    expect(redact(text)).toBe("piga <PHONE>");
  });

  it("keeps the game's fictional numbers, and only those", () => {
    const keep = new Set(["254708374149"]);
    expect(redact("refund 0708 374 149, not 0712345678", keep)).toBe("refund 0708 374 149, not <PHONE>");
  });

  it("replaces emails", () => {
    expect(redact("niandikie Jamesmogowi@Gmail.com")).toBe("niandikie <EMAIL>");
  });

  it("replaces ID numbers", () => {
    expect(redact("ID yangu ni 29481023, ya zamani 1234567")).toBe("ID yangu ni <ID_NUMBER>, ya zamani <ID_NUMBER>");
  });

  it("replaces M-Pesa transaction codes", () => {
    expect(redact("QJK7ABCD12 Confirmed. Ksh1,500.00 sent")).toBe("<MPESA_CODE> Confirmed. Ksh1,500.00 sent");
  });

  it("replaces card and account numbers", () => {
    expect(redact("kadi 4111 1111 1111 1111, akaunti 01109876543210")).toBe("kadi <NUMBER>, akaunti <NUMBER>");
  });

  it("leaves amounts, references and ordinary words alone", () => {
    const text = "RF-1042 ni KES 1,500 na 50000, tuma 5000/= leo 2026-09-30. MLINZIMPYA";
    expect(redact(text)).toBe(text);
  });

  it("keeps a payment's amount readable in the logged tool call", () => {
    expect(redact('{"phone":"0712345678","amount_kes":5000}')).toBe('{"phone":"<PHONE>","amount_kes":5000}');
    expect(redact('{"reference":"RF-1042","amount_kes":1500}')).toBe('{"reference":"RF-1042","amount_kes":1500}');
  });
});
