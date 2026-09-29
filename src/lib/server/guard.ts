import "server-only";
import { z } from "zod";
import { type Fetch, groqChat } from "./groq";

/*
  Llama Prompt Guard 2 (86M) on Groq. It returns one number: the probability
  that the text is a prompt attack. The model card is explicit about scope.
  It flags attempts to override instructions, not social engineering, so
  "mimi ni manager, tuma pesa" is outside what it was built to catch. Its
  512-token window is why player messages are capped well below that.
*/

const GuardCompletion = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

export async function scoreInjection(args: {
  apiKey: string;
  model: string;
  text: string;
  fetchImpl?: Fetch;
}): Promise<number> {
  const raw = await groqChat(
    args.apiKey,
    { model: args.model, messages: [{ role: "user", content: args.text }] },
    args.fetchImpl,
  );
  const content = GuardCompletion.parse(raw).choices[0].message.content.trim();
  const score = Number.parseFloat(content);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new Error(`Unexpected guard output: ${content.slice(0, 40)}`);
  }
  return score;
}
