import { runDDAgent, type DDAgentEvent, type DDBrief } from "@/lib/ai/dd-analyst";
import { getCompanyById, getDb, listCampaignsByCompany } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

type StreamEvent =
  | DDAgentEvent
  | { type: "brief"; brief: DDBrief; generatedAt: number }
  | { type: "done" }
  | { type: "error"; message: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const company = getCompanyById(id);
  if (!company) {
    return new Response(JSON.stringify({ error: "Company not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  const campaigns = listCampaignsByCompany(id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {}
      };

      try {
        const brief = await runDDAgent({
          company,
          campaigns,
          onEvent: (e) => send(e),
        });
        const generatedAt = Date.now();
        getDb()
          .prepare(
            "INSERT INTO dd_briefs (company_id, brief_json, generated_at) VALUES (?, ?, ?)"
          )
          .run(id, JSON.stringify(brief), generatedAt);
        send({ type: "brief", brief, generatedAt });
        send({ type: "done" });
        controller.close();
      } catch (e) {
        send({
          type: "error",
          message: e instanceof Error ? e.message : String(e),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
