const SIRENE_BASES = [
  "https://api.insee.fr/api-sirene/3.11",
  "https://api.insee.fr/entreprises/sirene/V3.11",
];
const TIMEOUT_MS = 8_000;

export type CompanyLookupResult =
  | {
      found: true;
      siren: string;
      legalName: string;
      legalFormCode: string | null;
      foundedDate: string | null;
      principalActivity: string | null;
      address: string | null;
      isActive: boolean;
    }
  | { found: false; reason: string };

export async function companyLookup(
  name: string,
  country: string
): Promise<CompanyLookupResult> {
  if (country !== "FR") {
    return { found: false, reason: "non_FR_lookup_unsupported" };
  }

  const token = process.env.SIRENE_API_TOKEN;
  if (!token) return { found: false, reason: "missing_sirene_token" };

  // SIRENE expects exact-match search on denominationUniteLegale. Use a phrase
  // query (parens + quotes); fall back to a fuzzy match if nothing returned.
  const escaped = name.replace(/"/g, '\\"');
  const queries = [
    `denominationUniteLegale:"${escaped}"`,
    `denominationUniteLegale:${escaped}*`,
  ];

  for (const base of SIRENE_BASES) {
    for (const q of queries) {
      const url = `${base}/siret?q=${encodeURIComponent(q)}&nombre=1`;
      try {
        const res = await fetch(url, {
          headers: {
            "X-INSEE-Api-Key-Integration": token,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 401 || res.status === 403) {
          return { found: false, reason: `sirene_auth_${res.status}` };
        }
        if (!res.ok) continue;

        const data = (await res.json()) as SireneSiretResponse;
        const etab = data?.etablissements?.[0];
        if (!etab) continue;

        const u = etab.uniteLegale ?? {};
        const a = etab.adresseEtablissement ?? {};
        return {
          found: true,
          siren: etab.siren ?? "",
          legalName:
            u.denominationUniteLegale ||
            [u.prenom1UniteLegale, u.nomUniteLegale]
              .filter(Boolean)
              .join(" ") ||
            name,
          legalFormCode: u.categorieJuridiqueUniteLegale ?? null,
          foundedDate: u.dateCreationUniteLegale ?? null,
          principalActivity: u.activitePrincipaleUniteLegale ?? null,
          address: formatAddress(a),
          isActive: u.etatAdministratifUniteLegale === "A",
        };
      } catch {
        continue;
      }
    }
  }

  return { found: false, reason: "no_match_or_unavailable" };
}

type SireneSiretResponse = {
  etablissements?: Array<{
    siren?: string;
    uniteLegale?: {
      denominationUniteLegale?: string;
      prenom1UniteLegale?: string;
      nomUniteLegale?: string;
      categorieJuridiqueUniteLegale?: string;
      dateCreationUniteLegale?: string;
      activitePrincipaleUniteLegale?: string;
      etatAdministratifUniteLegale?: string;
    };
    adresseEtablissement?: {
      numeroVoieEtablissement?: string;
      typeVoieEtablissement?: string;
      libelleVoieEtablissement?: string;
      codePostalEtablissement?: string;
      libelleCommuneEtablissement?: string;
    };
  }>;
};

function formatAddress(a: NonNullable<SireneSiretResponse["etablissements"]>[number]["adresseEtablissement"]): string | null {
  if (!a) return null;
  const parts = [
    [a.numeroVoieEtablissement, a.typeVoieEtablissement, a.libelleVoieEtablissement]
      .filter(Boolean)
      .join(" "),
    [a.codePostalEtablissement, a.libelleCommuneEtablissement]
      .filter(Boolean)
      .join(" "),
  ].filter((s): s is string => Boolean(s));
  return parts.length ? parts.join(", ") : null;
}
