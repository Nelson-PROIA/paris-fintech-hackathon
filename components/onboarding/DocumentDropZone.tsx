"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChipOption, ProfileType } from "@/lib/onboarding/types";

export type UploadedDocument = {
  id: string;
  filename: string;
  url: string;
  mime: string;
  size: number;
  category: string | null;
  uploaded_at: number;
};

type Props = {
  profileType: ProfileType;
  categories: ChipOption[];
  documents: UploadedDocument[];
  onChange: (next: UploadedDocument[]) => void;
  accept?: string;
  multiple?: boolean;
};

export function DocumentDropZone({
  profileType,
  categories,
  documents,
  onChange,
  accept = "application/pdf,image/png,image/jpeg",
  multiple = true,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    setError(null);
    const list = Array.from(files);
    if (!list.length) return;

    for (const file of list) {
      const tempId = `temp-${file.name}-${Date.now()}`;
      setUploading((u) => [...u, tempId]);
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("profileType", profileType);
        const res = await fetch("/api/onboarding/upload", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        onChange([...documents, data.document as UploadedDocument]);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setUploading((u) => u.filter((id) => id !== tempId));
      }
    }
  }

  function updateCategory(id: string, category: string) {
    onChange(
      documents.map((d) => (d.id === id ? { ...d, category } : d))
    );
    void fetch("/api/onboarding/upload", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileType, documentId: id, category }),
    });
  }

  function remove(id: string) {
    onChange(documents.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) {
            void handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed px-6 py-10 text-sm transition-all duration-200",
          dragOver
            ? "border-brand/60 bg-brand-muted/40 shadow-lift"
            : "border-border bg-card/40 hover:border-brand/30 hover:bg-card/70"
        )}
      >
        {dragOver && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 gradient-mesh opacity-40"
          />
        )}
        <span
          className={cn(
            "relative flex h-11 w-11 items-center justify-center rounded-xl transition",
            dragOver
              ? "gradient-brand text-brand-foreground shadow-lift ring-1 ring-inset ring-white/30"
              : "border border-border bg-card text-muted-foreground group-hover:border-brand/30 group-hover:text-brand"
          )}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 13v8" />
            <path d="M4 14a4 4 0 0 1 .9-7.9 5 5 0 0 1 9.6-2.4 4.5 4.5 0 0 1 5.4 6.7" />
            <path d="m8 17 4-4 4 4" />
          </svg>
        </span>
        <div className="relative text-center">
          <p className="font-serif text-base font-semibold tracking-tight">
            {dragOver ? "Drop to upload" : "Drag and drop your documents"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            or{" "}
            <span className="font-medium text-brand underline-offset-2 group-hover:underline">
              click to select
            </span>{" "}
            · PDF, PNG, JPG
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {uploading.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand" />
          Uploading {uploading.length} file{uploading.length === 1 ? "" : "s"}…
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card/60">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-2 px-3 py-2.5 transition hover:bg-accent/30 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-card font-mono text-[10px] font-semibold uppercase text-muted-foreground"
                  aria-hidden
                >
                  PDF
                </span>
                <div className="min-w-0">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-medium transition hover:text-brand hover:underline-offset-2 hover:underline"
                  >
                    {doc.filename}
                  </a>
                  <p className="text-[11px] text-muted-foreground">
                    {Math.round(doc.size / 1024)} KB · {doc.mime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={doc.category ?? ""}
                  onChange={(e) => updateCategory(doc.id, e.target.value)}
                  className="rounded-md border border-border bg-card px-2 py-1 text-xs transition focus:border-brand/30 focus:outline-none focus:ring-1 focus:ring-brand/20"
                >
                  <option value="">— category —</option>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => remove(doc.id)}
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                >
                  remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
