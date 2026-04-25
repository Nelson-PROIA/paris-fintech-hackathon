const eurFmt = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function fmtEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (Math.abs(n) >= 10_000) return `€${Math.round(n / 1000)}k`;
  return eurFmt.format(n);
}

export function fmtEurExact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return eurFmt.format(n);
}

const COUNTRY_FLAGS: Record<string, string> = {
  FR: "🇫🇷", DE: "🇩🇪", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱",
  BE: "🇧🇪", PT: "🇵🇹", AT: "🇦🇹", IE: "🇮🇪", FI: "🇫🇮",
  SE: "🇸🇪", DK: "🇩🇰", PL: "🇵🇱", GR: "🇬🇷", CH: "🇨🇭",
  GB: "🇬🇧", UK: "🇬🇧", LU: "🇱🇺",
};

export function flagFor(country: string | null | undefined): string {
  if (!country) return "🌍";
  return COUNTRY_FLAGS[country.toUpperCase()] ?? "🌍";
}
