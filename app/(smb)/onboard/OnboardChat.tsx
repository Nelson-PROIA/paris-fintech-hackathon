"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  REQUIRED_FOR_FINALIZE,
  type SMBFields,
} from "@/lib/ai/onboarding-smb";

const INITIAL_MESSAGES: UIMessage[] = [
  {
    id: "greeting",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Hi! I'll help you put a listing together for investors. To start — what's the name of your company, and what do you actually do?",
      },
    ],
  },
];

export function OnboardChat() {
  const router = useRouter();
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/smb/onboard" }),
    messages: INITIAL_MESSAGES,
  });

  const [input, setInput] = useState("");
  const [partial, setPartial] = useState<Partial<SMBFields>>({});
  const [extractStatus, setExtractStatus] = useState<"idle" | "running">("idle");
  const [finalizeStatus, setFinalizeStatus] = useState<
    "idle" | "running" | "error"
  >("idle");
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const transcript = useMemo(() => buildTranscript(messages), [messages]);

  const lastExtractedAt = useRef<number>(0);
  useEffect(() => {
    if (status !== "ready") return;
    const userTurns = messages.filter((m) => m.role === "user").length;
    if (userTurns < 1) return;
    if (userTurns === lastExtractedAt.current) return;
    lastExtractedAt.current = userTurns;

    setExtractStatus("running");
    fetch("/api/smb/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    })
      .then((r) => r.json())
      .then((data: SMBFields | { error: string }) => {
        if ("error" in data) return;
        setPartial(data);
      })
      .finally(() => setExtractStatus("idle"));
  }, [status, messages, transcript]);

  const missing = REQUIRED_FOR_FINALIZE.filter((k) => partial[k] == null);
  const canFinalize =
    missing.length === 0 && status === "ready" && finalizeStatus !== "running";

  async function handleFinalize() {
    setFinalizeStatus("running");
    setFinalizeError(null);
    try {
      const res = await fetch("/api/smb/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed (${res.status})`);
      }
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setFinalizeError(e instanceof Error ? e.message : String(e));
      setFinalizeStatus("error");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
      <section className="flex h-[70vh] flex-col rounded-lg border border-border">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-auto max-w-[85%] rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
                  : "max-w-[85%] rounded-lg bg-secondary px-4 py-2 text-sm text-secondary-foreground"
              }
            >
              {renderText(m)}
            </div>
          ))}
          {status === "submitted" && (
            <div className="max-w-[85%] rounded-lg bg-secondary px-4 py-2 text-sm text-muted-foreground">
              …
            </div>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}
          <div ref={listEndRef} />
        </div>
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 border-t border-border p-3"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status === "streaming" || status === "submitted"}
            placeholder="Type your reply…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={
              !input.trim() || status === "streaming" || status === "submitted"
            }
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </section>

      <aside className="flex h-[70vh] flex-col rounded-lg border border-border">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Listing preview
          </h2>
          <span className="text-xs text-muted-foreground">
            {extractStatus === "running" ? "updating…" : "live"}
          </span>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto p-5 text-sm">
          <PreviewField label="Name" value={partial.name} />
          <PreviewField label="Sector" value={partial.sector} />
          <PreviewField label="Stage" value={partial.stage} />
          <PreviewField
            label="Location"
            value={joinDefined(partial.city, partial.country)}
          />
          <PreviewField label="Founded" value={partial.founded_year?.toString()} />
          <PreviewField label="Team size" value={partial.team_size?.toString()} />
          <PreviewField
            label="MRR"
            value={
              partial.monthly_revenue_eur != null
                ? fmtEur(partial.monthly_revenue_eur)
                : null
            }
          />
          <PreviewField
            label="Burn / mo"
            value={
              partial.monthly_burn_eur != null
                ? fmtEur(partial.monthly_burn_eur)
                : null
            }
          />
          <PreviewField
            label="Capital seeking (initial campaign)"
            value={
              partial.capital_seeking_eur != null
                ? fmtEur(partial.capital_seeking_eur)
                : null
            }
          />
          <PreviewField label="Use of funds" value={partial.use_of_funds} />
          <PreviewField label="Website" value={partial.website} />
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Pitch summary
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {partial.pitch_summary ?? (
                <span className="text-muted-foreground">—</span>
              )}
            </p>
          </div>
        </div>
        <footer className="space-y-2 border-t border-border p-3">
          {missing.length > 0 && status === "ready" && (
            <p className="text-xs text-muted-foreground">
              Still missing: {missing.join(", ")}
            </p>
          )}
          {finalizeError && (
            <p className="text-xs text-destructive">{finalizeError}</p>
          )}
          <button
            type="button"
            onClick={handleFinalize}
            disabled={!canFinalize}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {finalizeStatus === "running"
              ? "Saving…"
              : "Finalize company + first campaign"}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PreviewField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-medium">
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

function renderText(m: UIMessage): React.ReactNode {
  return m.parts.map((p, i) => {
    if (p.type === "text") return <span key={i}>{p.text}</span>;
    return null;
  });
}

function buildTranscript(messages: UIMessage[]): string {
  return messages
    .map((m) => {
      const text = m.parts
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("");
      return `${m.role}: ${text}`;
    })
    .join("\n\n");
}

function joinDefined(
  ...parts: Array<string | null | undefined>
): string | null {
  const xs = parts.filter((p): p is string => Boolean(p));
  return xs.length ? xs.join(", ") : null;
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}
