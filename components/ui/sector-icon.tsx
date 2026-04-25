import { cn } from "@/lib/utils";

type SectorMeta = {
  emoji: string;
  hue: number;
};

const FALLBACK: SectorMeta = { emoji: "🏢", hue: 220 };

const SECTOR_MAP: Record<string, SectorMeta> = {
  saas: { emoji: "⚡", hue: 190 },
  "b2b saas": { emoji: "⚡", hue: 190 },
  software: { emoji: "💻", hue: 210 },
  manufacturing: { emoji: "🛠️", hue: 30 },
  retail: { emoji: "🏬", hue: 340 },
  "e-commerce": { emoji: "🛍️", hue: 310 },
  ecommerce: { emoji: "🛍️", hue: 310 },
  food: { emoji: "🍽️", hue: 25 },
  beverage: { emoji: "☕", hue: 35 },
  agriculture: { emoji: "🌾", hue: 90 },
  agritech: { emoji: "🌾", hue: 95 },
  fashion: { emoji: "👗", hue: 320 },
  textile: { emoji: "🧵", hue: 280 },
  hospitality: { emoji: "🏨", hue: 25 },
  logistics: { emoji: "🚚", hue: 220 },
  mobility: { emoji: "🚲", hue: 200 },
  energy: { emoji: "⚡", hue: 75 },
  cleantech: { emoji: "🌱", hue: 145 },
  health: { emoji: "🩺", hue: 170 },
  fintech: { emoji: "💳", hue: 245 },
  education: { emoji: "🎓", hue: 270 },
  media: { emoji: "🎬", hue: 0 },
  agency: { emoji: "✏️", hue: 320 },
  services: { emoji: "🤝", hue: 220 },
  consulting: { emoji: "📊", hue: 240 },
  craft: { emoji: "🎨", hue: 30 },
  makers: { emoji: "🔧", hue: 40 },
  pottery: { emoji: "🏺", hue: 25 },
  winery: { emoji: "🍷", hue: 350 },
  leather: { emoji: "👜", hue: 30 },
  data: { emoji: "📊", hue: 250 },
};

export function getSectorMeta(sector: string | null | undefined): SectorMeta {
  if (!sector) return FALLBACK;
  const key = sector.toLowerCase().trim();
  if (SECTOR_MAP[key]) return SECTOR_MAP[key];
  for (const [k, v] of Object.entries(SECTOR_MAP)) {
    if (key.includes(k)) return v;
  }
  return FALLBACK;
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
  const meta = getSectorMeta(sector);
  const sizeClass =
    size === "sm" ? "h-7 w-7 text-base" : size === "lg" ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg";
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-white/40 shadow-soft",
        sizeClass,
        className
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, oklch(0.92 0.08 ${meta.hue}), oklch(0.78 0.16 ${meta.hue}))`,
      }}
      aria-hidden
    >
      <span className="drop-shadow-sm">{meta.emoji}</span>
    </span>
  );
}
