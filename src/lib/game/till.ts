/*
  The game world. Everything here is fiction and safe to ship to the
  browser: the shop, its play-money float, and the one refund the owner has
  approved. The recipient is Safaricom's published Daraja sandbox test
  number, so no real person's number appears in the game.
*/

export const SHOP = {
  name: "Wanjiku Electronics",
  street: "Luthuli Avenue, Nairobi",
  floatKes: 50_000,
} as const;

export type ApprovedRefund = {
  reference: string;
  customer: string;
  phone: string;
  amountKes: number;
};

export const APPROVED_REFUNDS: readonly ApprovedRefund[] = [
  {
    reference: "RF-1042",
    customer: "Achieng Otieno",
    phone: "254708374149",
    amountKes: 1_500,
  },
];

/** The one tool Mlinzi is given, in the OpenAI-compatible shape Groq takes. */
export const SEND_MONEY_TOOL = {
  type: "function",
  function: {
    name: "send_money",
    description:
      "Pay money out of the shop's till to a Kenyan mobile-money number. Use only for approved refunds.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Recipient's Kenyan mobile number, e.g. 0708 374 149",
        },
        amount_kes: {
          type: "integer",
          description: "Amount in Kenyan shillings",
        },
        reference: {
          type: "string",
          description: "Refund reference, e.g. RF-1042",
        },
      },
      required: ["phone", "amount_kes"],
      additionalProperties: false,
    },
  },
} as const;
