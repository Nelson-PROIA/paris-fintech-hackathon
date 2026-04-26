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

/**
 * Returns the ISO-2 country code (uppercase) — no flag emoji.
 * Kept under the same name so existing call sites don't need to change.
 */
export function flagFor(country: string | null | undefined): string {
  if (!country) return "—";
  return country.toUpperCase();
}

/**
 * Turn a snake_case enum value into a properly capitalised, human-friendly
 * label. Used everywhere we render sector/stage/urgency/status tags so the
 * UI doesn't surface raw enum strings.
 *
 * @example
 *   humanize("saas_micro")            // "SaaS"
 *   humanize("b2b_services")          // "B2B services"
 *   humanize("professional_services") // "Professional services"
 *   humanize("very_urgent")           // "Very urgent"
 *   humanize("FR")                    // "FR"  (already a code)
 */
export function humanize(s: string | null | undefined): string {
  if (!s) return "—";
  const trimmed = s.trim();
  if (!trimmed) return "—";

  const SPECIAL: Record<string, string> = {
    saas_micro: "SaaS",
    b2b_services: "B2B services",
    professional_services: "Professional services",
    ecommerce: "E-commerce",
    pre_revenue: "Pre-revenue",
    very_urgent: "Very urgent",
    this_week: "This week",
    this_month: "This month",
    invoice_advance: "Invoice factoring",
    working_capital: "Working capital",
    stock_purchase: "Inventory purchase",
    supplier_payment: "Supplier payment",
    short_invest: "Short-term investment",
    real_estate: "Real estate",
  };
  if (SPECIAL[trimmed]) return SPECIAL[trimmed];

  // ISO codes and short caps stay as-is
  if (/^[A-Z]{2,3}$/.test(trimmed)) return trimmed;

  const spaced = trimmed.replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
