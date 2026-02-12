/**
 * INSEE SIRENE API Client
 * API Key authentication via X-INSEE-Api-Key-Integration header
 * Rate limited to 30 req/min
 * Docs: https://portail-api.insee.fr/
 */

interface INSEEUniteLegale {
  siren: string;
  denominationUniteLegale?: string;
  categorieJuridiqueUniteLegale?: string;
  activitePrincipaleUniteLegale?: string;
  trancheEffectifsUniteLegale?: string;
  dateCreationUniteLegale?: string;
  economieSocialeSolidaireUniteLegale?: string;
  periodesUniteLegale?: Array<{
    denominationUniteLegale?: string;
    activitePrincipaleUniteLegale?: string;
    nomenclatureActivitePrincipaleUniteLegale?: string;
  }>;
}

interface INSEEEtablissement {
  siret: string;
  siren: string;
  denominationUsuelleEtablissement?: string;
  adresseEtablissement?: {
    numeroVoieEtablissement?: string;
    typeVoieEtablissement?: string;
    libelleVoieEtablissement?: string;
    codePostalEtablissement?: string;
    libelleCommuneEtablissement?: string;
    codeCommuneEtablissement?: string;
  };
  uniteLegale?: INSEEUniteLegale;
}

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 30 req/min = 1 every 2s

const BASE_URL = "https://api.insee.fr/api-sirene/3.11";

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

function getApiKey(): string {
  const apiKey = process.env.INSEE_API_KEY;
  if (!apiKey) {
    throw new Error("INSEE_API_KEY not configured");
  }
  return apiKey;
}

export async function getEtablissementBySiret(siret: string): Promise<INSEEEtablissement | null> {
  await rateLimit();
  const apiKey = getApiKey();

  const res = await fetch(`${BASE_URL}/siret/${siret}`, {
    headers: {
      "X-INSEE-Api-Key-Integration": apiKey,
      Accept: "application/json",
    },
  });

  if (res.status === 404 || res.status === 400) return null;
  if (res.status === 429) {
    // Rate limited, wait and retry once
    await new Promise((r) => setTimeout(r, 5000));
    return getEtablissementBySiret(siret);
  }

  if (!res.ok) {
    throw new Error(`INSEE siret fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return data.etablissement || null;
}

export async function getUniteLegaleBySiren(siren: string): Promise<INSEEUniteLegale | null> {
  await rateLimit();
  const apiKey = getApiKey();

  const res = await fetch(`${BASE_URL}/siren/${siren}`, {
    headers: {
      "X-INSEE-Api-Key-Integration": apiKey,
      Accept: "application/json",
    },
  });

  if (res.status === 404 || res.status === 400) return null;
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    return getUniteLegaleBySiren(siren);
  }

  if (!res.ok) {
    throw new Error(`INSEE siren fetch failed: ${res.status}`);
  }

  const data = await res.json();
  return data.uniteLegale || null;
}

export async function searchSiegeParSiren(siren: string): Promise<INSEEEtablissement | null> {
  await rateLimit();
  const apiKey = getApiKey();

  const res = await fetch(
    `${BASE_URL}/siret?q=siren:${siren} AND etablissementSiege:true`,
    {
      headers: {
        "X-INSEE-Api-Key-Integration": apiKey,
        Accept: "application/json",
      },
    }
  );

  if (res.status === 404 || res.status === 400) return null;
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 5000));
    return searchSiegeParSiren(siren);
  }

  if (!res.ok) {
    throw new Error(`INSEE siege search failed: ${res.status}`);
  }

  const data = await res.json();
  return data.etablissements?.[0] || null;
}

export function parseINSEEToProspectData(
  uniteLegale: INSEEUniteLegale,
  etablissement?: INSEEEtablissement | null
) {
  const addr = etablissement?.adresseEtablissement;
  const period = uniteLegale.periodesUniteLegale?.[0];

  return {
    siret: etablissement?.siret || undefined,
    companyName:
      uniteLegale.denominationUniteLegale ||
      etablissement?.denominationUsuelleEtablissement ||
      undefined,
    legalForm: uniteLegale.categorieJuridiqueUniteLegale || undefined,
    nafCode:
      period?.activitePrincipaleUniteLegale ||
      uniteLegale.activitePrincipaleUniteLegale ||
      undefined,
    creationDate: uniteLegale.dateCreationUniteLegale
      ? new Date(uniteLegale.dateCreationUniteLegale)
      : undefined,
    employeeCount: parseTrancheEffectifs(uniteLegale.trancheEffectifsUniteLegale),
    address: addr
      ? [addr.numeroVoieEtablissement, addr.typeVoieEtablissement, addr.libelleVoieEtablissement]
          .filter(Boolean)
          .join(" ")
      : undefined,
    postalCode: addr?.codePostalEtablissement || undefined,
    city: addr?.libelleCommuneEtablissement || undefined,
  };
}

function parseTrancheEffectifs(tranche?: string): number | undefined {
  if (!tranche || tranche === "NN") return undefined;
  const map: Record<string, number> = {
    "00": 0, "01": 1, "02": 3, "03": 6,
    "11": 10, "12": 20, "21": 50, "22": 100,
    "31": 200, "32": 250, "41": 500, "42": 1000,
    "51": 2000, "52": 5000, "53": 10000,
  };
  return map[tranche] ?? undefined;
}

export type { INSEEUniteLegale, INSEEEtablissement };