"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, SlidersHorizontal, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: { results: { 0: { transcript: string } }[] }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

/**
 * Chat-style single-line input bar. Inspired by ChatGPT/Linear command bar:
 *
 *   [ filter ]  ask anything…  [ mic ]  [ ↑ ]
 *
 * Use this everywhere we previously had a tall labelled textarea +
 * "Plain English / Manual filters" tabs. The optional filter button
 * toggles a manual-filter panel rendered by the parent.
 */
export function NaturalLanguageInput({
  value,
  onChange,
  onSubmit,
  onToggleFilters,
  filtersOpen,
  filterCount,
  placeholder = "Ask anything…",
  status = "idle",
  disabled,
  lang = "en-GB",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  /** Show + wire a filter (sliders) button on the left when provided */
  onToggleFilters?: () => void;
  filtersOpen?: boolean;
  filterCount?: number;
  placeholder?: string;
  /** "parsing" puts a subtle pulse behind the bar */
  status?: "idle" | "parsing" | "loading";
  disabled?: boolean;
  lang?: string;
  className?: string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = lang;
    r.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((res) => res[0].transcript)
        .join(" ");
      const merged = baseTextRef.current
        ? `${baseTextRef.current} ${transcript}`.replace(/\s+/g, " ").trim()
        : transcript;
      onChange(merged);
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    recognitionRef.current = r;
    setSupported(true);
    return () => {
      try {
        r.abort();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  function toggleMic() {
    const r = recognitionRef.current;
    if (!r) return;
    if (isListening) {
      r.stop();
    } else {
      baseTextRef.current = value;
      try {
        r.start();
        setIsListening(true);
      } catch {
        // already running
      }
    }
  }

  const submitting = status === "parsing" || status === "loading";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim() || submitting) return;
        onSubmit?.();
      }}
      className={cn(
        "relative flex items-center gap-1.5 rounded-full border border-border bg-card px-1.5 py-1.5 shadow-sm transition focus-within:border-foreground/30 focus-within:shadow",
        submitting && "border-brand/40",
        className
      )}
    >
      {onToggleFilters && (
        <button
          type="button"
          onClick={onToggleFilters}
          aria-pressed={filtersOpen}
          aria-label="Toggle filters"
          className={cn(
            "ml-0.5 inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition",
            filtersOpen || (filterCount ?? 0) > 0
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <SlidersHorizontal size={13} />
          {filterCount && filterCount > 0 ? (
            <span className="font-mono tabular-nums">{filterCount}</span>
          ) : (
            <span>Filters</span>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled || submitting}
        className="min-w-0 flex-1 bg-transparent px-3 py-1.5 text-[14px] outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
      />

      {supported && (
        <button
          type="button"
          onClick={toggleMic}
          title={isListening ? "Stop listening" : "Speak"}
          aria-label={isListening ? "Stop listening" : "Speak"}
          className={cn(
            "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition",
            isListening
              ? "bg-destructive text-white animate-pulse-soft"
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          {isListening ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
      )}

      <button
        type="submit"
        disabled={!value.trim() || submitting || disabled}
        aria-label="Submit"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition disabled:bg-muted disabled:text-muted-foreground/50"
      >
        {submitting ? (
          <span className="inline-flex h-1.5 w-1.5 animate-pulse-soft rounded-full bg-current" />
        ) : (
          <ArrowUp size={16} strokeWidth={2.5} />
        )}
      </button>
    </form>
  );
}
