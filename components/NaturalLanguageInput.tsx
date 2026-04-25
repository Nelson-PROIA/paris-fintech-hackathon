"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

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
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-md border border-border bg-background px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
        {supported && (
          <button
            type="button"
            onClick={toggle}
            title={isListening ? "Stop listening" : "Speak"}
            aria-label={isListening ? "Stop listening" : "Speak"}
            className={
              isListening
                ? "absolute right-2 top-2 flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-rose-500 text-white"
                : "absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border hover:bg-accent"
            }
          >
            {isListening ? <MicOff size={14} /> : <Mic size={14} />}
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
