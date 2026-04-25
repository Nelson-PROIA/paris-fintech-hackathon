import { companyLookup } from "@/lib/tools/company-lookup";
import { webSearch } from "@/lib/tools/web-search";
import type { EnrichmentResult, ProfileData } from "./types";

/**
 * Pluggable interface for enriching a company profile from external sources.
 * Today only `SireneTavilyEnricher` is wired in. A future `PappersEnricher`
 * can be plugged in by swapping the resolver in routes that use this.
 */
export interface CompanyEnricher {
  enrich(input: CompanyEnrichInput): Promise<EnrichmentResult>;
}

export type CompanyEnrichInput = {
  legalName: string;
  country: string | null;
  city: string | null;
  siret: string | null;
};

const EMPTY_RESULT = (legalName: string): EnrichmentResult => ({
  source: "none",
  legal_name: legalName,
  siren: null,
  founded_date: null,
  founded_year: null,
  principal_activity: null,
  address: null,
  is_active: null,
  web_mentions: [],
  suggested_fields: {},
  generated_at: new Date().toISOString(),
});

export class SireneTavilyEnricher implements CompanyEnricher {
  async enrich(input: CompanyEnrichInput): Promise<EnrichmentResult> {
    const result: EnrichmentResult = {
      ...EMPTY_RESULT(input.legalName),
      source: "sirene_tavily",
    };

    if (input.country === "FR") {
      try {
        const lookup = await companyLookup(input.legalName, "FR");
        if (lookup.found) {
          result.siren = lookup.siren || null;
          result.legal_name = lookup.legalName || input.legalName;
          result.founded_date = lookup.foundedDate || null;
          result.founded_year = parseYear(lookup.foundedDate);
          result.principal_activity = lookup.principalActivity || null;
          result.address = lookup.address || null;
          result.is_active = lookup.isActive;
        }
      } catch {
        // SIRENE failures are non-fatal; we still try the web search.
      }
    }

    try {
      const query = [
        input.legalName,
        input.city ?? "",
        input.country && input.country !== "OTHER" ? input.country : "",
      ]
        .filter(Boolean)
        .join(" ");
      const hits = await webSearch(query, 5);
      result.web_mentions = hits.map((h) => ({
        title: h.title,
        url: h.url,
        excerpt: truncate(h.content, 280),
      }));
    } catch {
      // Web search failures are non-fatal.
    }

    result.suggested_fields = buildSuggestedFields(result);
    return result;
  }
}

/**
 * Map enrichment result → form field suggestions.
 * Only fields the enricher is confident about end up here.
 */
function buildSuggestedFields(r: EnrichmentResult): Partial<ProfileData> {
  const out: Partial<ProfileData> = {};

  if (r.legal_name) out.legal_name_suggested = r.legal_name;

  if (r.founded_year != null) {
    const ageYears = new Date().getFullYear() - r.founded_year;
    out.age_bucket_suggested = mapAgeToBucket(ageYears);
  }

  if (r.address) out.address_suggested = r.address;
  if (r.principal_activity)
    out.principal_activity_suggested = r.principal_activity;
  if (r.siren) out.siren_suggested = r.siren;

  return out;
}

function mapAgeToBucket(ageYears: number): number {
  if (ageYears < 1) return 0;
  if (ageYears <= 3) return 2;
  if (ageYears <= 5) return 4;
  if (ageYears <= 10) return 7;
  return 12;
}

function parseYear(date: string | null): number | null {
  if (!date) return null;
  const m = date.match(/^(\d{4})/);
  return m ? Number(m[1]) : null;
}

function truncate(s: string, max: number): string {
  if (!s) return "";
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

let _default: CompanyEnricher | null = null;
export function getDefaultEnricher(): CompanyEnricher {
  if (!_default) _default = new SireneTavilyEnricher();
  return _default;
}
