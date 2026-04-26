"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
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
  onerror:
    | ((event: { error: string }) => void)
    | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export function NaturalLanguageInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  lang = "en-GB",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  lang?: string;
}) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");

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
    r.onerror = (e) => {
      setError(e.error);
      setIsListening(false);
    };
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

  function toggle() {
    const r = recognitionRef.current;
    if (!r) return;
    setError(null);
    if (isListening) {
      r.stop();
    } else {
      baseTextRef.current = value;
      try {
        r.start();
        setIsListening(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }
  }

  return (
    <div className="space-y-1">
      <div className="group relative">
        {/* Decorative gradient ring on focus */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-xl opacity-0 transition group-focus-within:opacity-100",
            "bg-gradient-to-br from-brand/30 via-chart-4/20 to-warning/20 blur"
          )}
        />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="relative w-full resize-y rounded-xl border border-border bg-card/80 px-4 py-3 pr-14 text-sm leading-relaxed shadow-soft transition placeholder:text-muted-foreground/70 focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/30"
        />
        {supported && (
          <button
            type="button"
            onClick={toggle}
            title={isListening ? "Stop listening" : "Speak"}
            aria-label={isListening ? "Stop listening" : "Speak"}
            className={cn(
              "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full transition-all",
              isListening
                ? "bg-destructive text-white shadow-lift animate-glow-pulse"
                : "border border-border bg-card text-muted-foreground hover:border-brand/40 hover:text-brand"
            )}
          >
            {isListening ? <MicOff size={15} /> : <Mic size={15} />}
          </button>
        )}
      </div>
      {!supported && (
        <p className="text-xs text-muted-foreground">
          Voice input not supported in this browser. Try Chrome or Edge — or
          just type.
        </p>
      )}
      {error && <p className="text-xs text-destructive">Mic: {error}</p>}
    </div>
  );
}
