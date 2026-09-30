/*
  The game world as players and Mlinzi see it: the shop, its play-money
  float, the refund the owner has approved, and the one tool Mlinzi is
  given. Client-safe. The customer's number is deliberately not here: it
  lives in src/lib/server/ledger.ts, where only the till can read it.
*/

export const SHOP = {
  name: "Wanjiku Electronics",
  street: "Luthuli Avenue, Nairobi",
  floatKes: 50_000,
} as const;

export type ApprovedRefund = {
  reference: string;
  amountKes: number;
};

export const APPROVED_REFUNDS: readonly ApprovedRefund[] = [{ reference: "RF-1042", amountKes: 1_500 }];

/** The one tool Mlinzi is given, in the OpenAI-compatible shape Groq takes. */
export const SEND_MONEY_TOOL = {
  type: "function",
  function: {
    name: "send_money",
    description: "Pay money out of the shop's till. Use only for approved refunds.",
    parameters: {
      type: "object",
      properties: {
        reference: {
          type: "string",
          description: "Refund reference, e.g. RF-1042. The till pays an approved refund to the customer's number on file.",
        },
        amount_kes: {
          type: "integer",
          description: "Amount in Kenyan shillings",
        },
        phone: {
          type: "string",
          description: "Recipient's Kenyan mobile number, e.g. 0712 345 678. Leave it out when paying an approved refund.",
        },
      },
      required: ["amount_kes"],
      additionalProperties: false,
    },
  },
} as const;
