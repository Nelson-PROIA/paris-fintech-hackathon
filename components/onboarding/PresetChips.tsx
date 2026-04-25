"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ChipOption } from "@/lib/onboarding/types";

type Common = {
  options: ChipOption[];
  allowOther?: boolean;
  disabled?: boolean;
};

type SingleProps = Common & {
  mode: "single";
  value: string | null | undefined;
  onChange: (next: string | null) => void;
};

type MultiProps = Common & {
  mode: "multi";
  value: string[] | null | undefined;
  onChange: (next: string[]) => void;
};

export function PresetChips(props: SingleProps | MultiProps) {
  const isOtherActive =
    props.mode === "single"
      ? typeof props.value === "string" &&
        !props.options.find((o) => o.value === props.value) &&
        props.value !== "" &&
        props.value !== null
      : Array.isArray(props.value) &&
        props.value.some(
          (v) => !props.options.find((o) => o.value === v) && v !== ""
        );

  const [otherText, setOtherText] = useState<string>(() => {
    if (!isOtherActive) return "";
    if (props.mode === "single") return (props.value as string) ?? "";
    const found = (props.value as string[] | null | undefined)?.find(
      (v) => !props.options.find((o) => o.value === v)
    );
    return found ?? "";
  });

  const isSelected = (val: string): boolean => {
    if (props.mode === "single") return props.value === val;
    return Array.isArray(props.value) && props.value.includes(val);
  };

  function pick(val: string) {
    if (props.disabled) return;
    if (props.mode === "single") {
      props.onChange(props.value === val ? null : val);
      return;
    }
    const current = Array.isArray(props.value) ? props.value : [];
    const next = current.includes(val)
      ? current.filter((v) => v !== val)
      : [...current, val];
    props.onChange(next);
  }

  function setOther(text: string) {
    setOtherText(text);
    if (props.mode === "single") {
      props.onChange(text || null);
      return;
    }
    const current = Array.isArray(props.value) ? props.value : [];
    const stripped = current.filter((v) =>
      props.options.some((o) => o.value === v)
    );
    props.onChange(text ? [...stripped, text] : stripped);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {props.options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            disabled={props.disabled}
            onClick={() => pick(opt.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              isSelected(opt.value)
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background hover:bg-accent",
              props.disabled && "opacity-50"
            )}
          >
            {opt.label}
            {opt.hint && (
              <span className="ml-1 text-xs opacity-70">· {opt.hint}</span>
            )}
          </button>
        ))}
        {props.allowOther && (
          <button
            type="button"
            disabled={props.disabled}
            onClick={() => {
              if (isOtherActive) {
                setOtherText("");
                if (props.mode === "single") props.onChange(null);
                else
                  props.onChange(
                    (props.value as string[] | null | undefined)?.filter((v) =>
                      props.options.some((o) => o.value === v)
                    ) ?? []
                  );
              } else {
                setOtherText(" ");
              }
            }}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              isOtherActive
                ? "border-foreground bg-foreground text-background"
                : "border-dashed border-border bg-background hover:bg-accent"
            )}
          >
            Autre…
          </button>
        )}
      </div>
      {props.allowOther && isOtherActive && (
        <input
          autoFocus
          value={otherText.trim()}
          onChange={(e) => setOther(e.target.value)}
          disabled={props.disabled}
          placeholder="Précise…"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}
    </div>
  );
}
