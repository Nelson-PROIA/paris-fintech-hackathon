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
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-sm transition",
          dragOver
            ? "border-foreground bg-accent"
            : "border-border bg-background hover:bg-accent/50"
        )}
      >
        <p className="font-medium">
          Drag and drop your documents here
        </p>
        <p className="text-xs text-muted-foreground">
          or click to select · PDF, PNG, JPG
        </p>
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
        <p className="text-xs text-muted-foreground">
          Uploading {uploading.length} file{uploading.length === 1 ? "" : "s"}…
        </p>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {documents.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {doc.filename}
                </a>
                <p className="text-xs text-muted-foreground">
                  {Math.round(doc.size / 1024)} KB · {doc.mime}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={doc.category ?? ""}
                  onChange={(e) => updateCategory(doc.id, e.target.value)}
                  className="rounded-md border border-border bg-background px-2 py-1 text-xs"
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
                  className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
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
