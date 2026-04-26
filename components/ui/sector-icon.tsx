import { cn } from "@/lib/utils";
import { humanize } from "@/lib/format";

/**
 * No emojis. Each sector gets a stable hue (tinted brand-aligned background)
 * + a 2-letter monogram derived from the humanised label. Modern, clean,
 * sortable, and light/dark-mode safe.
 */

const HUE_MAP: Record<string, number> = {
  saas_micro: 200,
  b2b_services: 220,
  agency: 320,
  professional_services: 240,
  manufacturing: 30,
  retail: 340,
  ecommerce: 290,
  makers: 60,
  data: 250,
  hospitality: 25,
  energy: 75,
  cleantech: 145,
  health: 170,
  fintech: 245,
  education: 270,
  logistics: 220,
  mobility: 200,
};

function hueFor(sector: string | null | undefined): number {
  if (!sector) return 220;
  const k = sector.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (HUE_MAP[k] != null) return HUE_MAP[k];
  // Stable hash so unknown sectors get a consistent colour
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h % 360;
}

function monogram(sector: string | null | undefined): string {
  const label = humanize(sector ?? "");
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) {
    const w = words[0];
    return (w[0] + (w[1] ?? "")).toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function SectorIcon({
  sector,
  className,
  size = "md",
}: {
  sector: string | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const hue = hueFor(sector);
  const sizeClass =
    size === "sm"
      ? "h-7 w-7 text-[10px]"
      : size === "lg"
        ? "h-12 w-12 text-sm"
        : "h-9 w-9 text-[11px]";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold tracking-tight tabular-nums",
        sizeClass,
        className
      )}
      style={{
        backgroundColor: `oklch(0.96 0.04 ${hue})`,
        color: `oklch(0.32 0.12 ${hue})`,
        border: `1px solid oklch(0.88 0.06 ${hue})`,
      }}
      aria-hidden
    >
      {monogram(sector)}
    </span>
  );
}

// Kept for callers that still import getSectorMeta — returns hue only now.
export function getSectorMeta(sector: string | null | undefined): { hue: number } {
  return { hue: hueFor(sector) };
}
