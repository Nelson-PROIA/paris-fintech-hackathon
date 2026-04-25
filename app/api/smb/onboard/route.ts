import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { mistral, MODEL_LARGE } from "@/lib/ai/client";
import { ONBOARDING_SYSTEM_PROMPT } from "@/lib/ai/onboarding-smb";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: mistral(MODEL_LARGE),
    system: ONBOARDING_SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    temperature: 0.7,
  });

  return result.toUIMessageStreamResponse();
}
