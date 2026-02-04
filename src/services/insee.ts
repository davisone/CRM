/**
 * INSEE SIRENE API Client
 * OAuth2 with 24h token, rate limited to 30 req/min
 * Docs: https://api.insee.fr/catalogue/site/themes/wso2/subthemes/insee/pages/item-info.jag?name=Sirene&version=V3&provider=insee
 */

interface INSEETokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

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

let tokenCache: { token: string; expiresAt: number } | null = null;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 2000; // 30 req/min = 1 every 2s

const BASE_URL = "https://api.insee.fr/entreprises/sirene/V3.11";
const TOKEN_URL = "https://api.insee.fr/token";

async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const clientId = process.env.INSEE_CLIENT_ID;
  const clientSecret = process.env.INSEE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("INSEE credentials not configured (INSEE_CLIENT_ID / INSEE_CLIENT_SECRET)");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`INSEE token failed: ${res.status}`);
  }

  const data: INSEETokenResponse = await res.json();
  tokenCache = {
    token: data.access_token,
    // Refresh 1h before expiry (tokens last ~24h)
    expiresAt: Date.now() + (data.expires_in - 3600) * 1000,
  };

  return data.access_token;
}

export async function getEtablissementBySiret(siret: string): Promise<INSEEEtablissement | null> {
  await rateLimit();
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/siret/${siret}`, {
    headers: {
      Authorization: `Bearer ${token}`,
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
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/siren/${siren}`, {
    headers: {
      Authorization: `Bearer ${token}`,
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
  const token = await getToken();

  const res = await fetch(
    `${BASE_URL}/siret?q=siren:${siren} AND etablissementSiege:true`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
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
