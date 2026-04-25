"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CollateralRow } from "@/lib/db";

const TYPES = [
  { value: "real_estate", label: "Real estate" },
  { value: "equipment", label: "Equipment" },
  { value: "contract", label: "Contract / Receivable" },
  { value: "inventory", label: "Inventory" },
  { value: "receivables", label: "Receivables" },
  { value: "other", label: "Other" },
] as const;

export function ManageCollateralClient({
  campaignId,
  initialCollaterals,
}: {
  campaignId: string;
  initialCollaterals: CollateralRow[];
}) {
  const router = useRouter();
  const [collaterals, setCollaterals] = useState(initialCollaterals);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>(
    "real_estate"
  );
  const [description, setDescription] = useState("");
  const [declaredValue, setDeclaredValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "verifying" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!description.trim() || !declaredValue) {
      setError("Description and declared value are required.");
      return;
    }
    setStatus("uploading");
    const fd = new FormData();
    fd.append("type", type);
    fd.append("description", description);
    fd.append("declaredValueEur", declaredValue);
    if (file) fd.append("file", file);

    setStatus("verifying");
    try {
      const res = await fetch(`/api/campaign/${campaignId}/collateral`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDescription("");
      setDeclaredValue("");
      setFile(null);
      setStatus("idle");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }

  return (
    <>
      <section className="mt-8 space-y-4 rounded-lg border border-border p-5">
        <h2 className="text-lg font-semibold">Add collateral</h2>
        <p className="text-xs text-muted-foreground">
          Upload a supporting document (PDF preferred). The AI will read it and
          assign a verification confidence score for investors.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Declared value (€)">
            <input
              type="number"
              value={declaredValue}
              onChange={(e) => setDeclaredValue(e.target.value)}
              min={1}
              step={1000}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Commercial lease at 12 rue de Lyon, signed 2023, 9-year term."
            rows={3}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </Field>

        <Field label="Document (PDF or text)">
          <input
            type="file"
            accept=".pdf,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-xs"
          />
          {file && (
            <p className="text-xs text-muted-foreground">
              {file.name} — {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </Field>

        <div className="flex items-center justify-end gap-3">
          {error && <span className="text-xs text-destructive">{error}</span>}
          <button
            type="button"
            onClick={submit}
            disabled={status === "uploading" || status === "verifying"}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {status === "uploading"
              ? "Uploading…"
              : status === "verifying"
                ? "AI verifying…"
                : "Add + verify"}
          </button>
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-semibold">
          Existing collateral ({collaterals.length})
        </h2>
        {collaterals.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="space-y-2">
            {collaterals.map((c) => (
              <li
                key={c.id}
                className="rounded-md border border-border p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{c.description}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.type} · €{c.declared_value_eur.toLocaleString("en-GB")}
                  </span>
                </div>
                {c.ai_score != null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    AI verification confidence: <strong>{c.ai_score}/100</strong>
                  </p>
                )}
                {c.document_filename && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    File: {c.document_filename}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
