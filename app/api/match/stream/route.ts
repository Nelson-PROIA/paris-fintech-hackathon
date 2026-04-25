import { requireRole } from "@/lib/auth";
import {
  getCampaignWithCompany,
  getDb,
  getOrCreateInvestor,
  listCampaigns,
} from "@/lib/db";
import { streamMatchItems, type MatchedItemHydrated } from "@/lib/ai/match";

export const runtime = "nodejs";
export const maxDuration = 120;

type StreamEvent =
  | { type: "stage"; id: string; label: string }
  | { type: "stage:done"; id: string; detail?: string }
  | { type: "match"; item: MatchedItemHydrated }
  | { type: "done"; count: number; generatedAt: number }
  | { type: "error"; message: string };

export async function GET() {
  const user = await requireRole("investor");
  const investor = getOrCreateInvestor(
    user.id,
    user.display_name ?? user.email
  );

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      };

      try {
        // Stage 1 — read thesis
        send({
          type: "stage",
          id: "thesis",
          label: "Reading your thesis",
        });
        const sectors = investor.sectors_json
          ? (JSON.parse(investor.sectors_json) as string[])
          : undefined;
        const countries = investor.countries_json
          ? (JSON.parse(investor.countries_json) as string[])
          : undefined;
        const ticketMin = investor.ticket_min_eur ?? undefined;
        const ticketMax = investor.ticket_max_eur ?? undefined;

        const thesisBits: string[] = [];
        if (sectors?.length) thesisBits.push(`${sectors.length} sectors`);
        if (countries?.length) thesisBits.push(`${countries.length} countries`);
        if (ticketMin || ticketMax)
          thesisBits.push(
            `€${(ticketMin ?? 0).toLocaleString("en-GB")}–${(ticketMax ?? 0).toLocaleString("en-GB")}`
          );
        send({
          type: "stage:done",
          id: "thesis",
          detail: thesisBits.length ? thesisBits.join(" · ") : "free-form thesis",
        });

        // Stage 2 — pre-filter candidates
        send({
          type: "stage",
          id: "filter",
          label: "Filtering live campaigns",
        });
        const candidates = listCampaigns({
          sectors,
          countries,
          ticketMin,
          ticketMax,
          limit: 200,
        });
        send({
          type: "stage:done",
          id: "filter",
          detail: `${candidates.length} candidates shortlisted`,
        });

        if (!candidates.length) {
          send({ type: "done", count: 0, generatedAt: Date.now() });
          // Cache empty result
          getDb()
            .prepare(
              `INSERT INTO match_caches (investor_id, result_json, generated_at) VALUES (?, ?, ?)
               ON CONFLICT(investor_id) DO UPDATE SET result_json = excluded.result_json, generated_at = excluded.generated_at`
            )
            .run(investor.id, JSON.stringify([]), Date.now());
          controller.close();
          return;
        }

        // Stage 3 — stream rank
        send({
          type: "stage",
          id: "rank",
          label: "Mistral Large is ranking deals",
        });

        const hydrated: MatchedItemHydrated[] = [];
        await streamMatchItems(investor, candidates, (item) => {
          const camp = getCampaignWithCompany(item.campaignId);
          if (!camp) return;
          const h: MatchedItemHydrated = { ...item, campaign: camp };
          hydrated.push(h);
          send({ type: "match", item: h });
        });

        send({
          type: "stage:done",
          id: "rank",
          detail: `${hydrated.length} match${hydrated.length === 1 ? "" : "es"}`,
        });

        // Cache
        const generatedAt = Date.now();
        getDb()
          .prepare(
            `INSERT INTO match_caches (investor_id, result_json, generated_at) VALUES (?, ?, ?)
             ON CONFLICT(investor_id) DO UPDATE SET result_json = excluded.result_json, generated_at = excluded.generated_at`
          )
          .run(investor.id, JSON.stringify(hydrated), generatedAt);

        send({ type: "done", count: hydrated.length, generatedAt });
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
