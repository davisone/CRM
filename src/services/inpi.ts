/**
 * INPI RNE API Client
 * API du Registre National des Entreprises
 * Docs: https://data.inpi.fr/
 */

interface INPIAuthResponse {
  token: string;
}

interface INPICompany {
  siren: string;
  denominationUniteLegale?: string;
  sigleUniteLegale?: string;
  dateCreationUniteLegale?: string;
  categorieJuridiqueUniteLegale?: string;
  activitePrincipaleUniteLegale?: string;
  trancheEffectifsUniteLegale?: string;
  adresseEtablissement?: {
    numeroVoieEtablissement?: string;
    typeVoieEtablissement?: string;
    libelleVoieEtablissement?: string;
    codePostalEtablissement?: string;
    libelleCommuneEtablissement?: string;
  };
  dirigeants?: Array<{
    nom?: string;
    prenom?: string;
    qualite?: string;
    dateNaissance?: string;
  }>;
}

interface INPISearchResult {
  results: INPICompany[];
  totalResults: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const BASE_URL = "https://data.inpi.fr/api/v1";

async function authenticate(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const clientId = process.env.INPI_CLIENT_ID;
  const clientSecret = process.env.INPI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("INPI credentials not configured (INPI_CLIENT_ID / INPI_CLIENT_SECRET)");
  }

  const res = await fetch(`${BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: clientId, password: clientSecret }),
  });

  if (!res.ok) {
    throw new Error(`INPI auth failed: ${res.status} ${res.statusText}`);
  }

  const data: INPIAuthResponse = await res.json();
  // Token valid for ~23 hours, refresh at 22h
  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 22 * 60 * 60 * 1000,
  };

  return data.token;
}

export async function searchNewCompanies(
  dateFrom: string,
  dateTo: string,
  page = 1,
  pageSize = 100
): Promise<INPISearchResult> {
  const token = await authenticate();

  const params = new URLSearchParams({
    dateCreationMin: dateFrom,
    dateCreationMax: dateTo,
    page: String(page),
    pageSize: String(pageSize),
    sort: "dateCreation:desc",
  });

  const res = await fetch(`${BASE_URL}/entreprises?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INPI search failed: ${res.status} - ${text}`);
  }

  return res.json();
}

export async function getCompanyBySiren(siren: string): Promise<INPICompany | null> {
  const token = await authenticate();

  const res = await fetch(`${BASE_URL}/entreprises/${siren}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`INPI company fetch failed: ${res.status}`);
  }

  return res.json();
}

export function parseINPIToProspect(company: INPICompany) {
  const addr = company.adresseEtablissement;
  return {
    siren: company.siren,
    companyName:
      company.denominationUniteLegale ||
      company.sigleUniteLegale ||
      `Entreprise ${company.siren}`,
    legalForm: company.categorieJuridiqueUniteLegale || undefined,
    nafCode: company.activitePrincipaleUniteLegale || undefined,
    creationDate: company.dateCreationUniteLegale
      ? new Date(company.dateCreationUniteLegale)
      : undefined,
    address: addr
      ? [addr.numeroVoieEtablissement, addr.typeVoieEtablissement, addr.libelleVoieEtablissement]
          .filter(Boolean)
          .join(" ")
      : undefined,
    postalCode: addr?.codePostalEtablissement || undefined,
    city: addr?.libelleCommuneEtablissement || undefined,
    employeeCount: parseTrancheEffectifs(company.trancheEffectifsUniteLegale),
    directors: (company.dirigeants || []).map((d) => ({
      firstName: d.prenom || undefined,
      lastName: d.nom || "Inconnu",
      role: d.qualite || undefined,
      birthDate: d.dateNaissance ? new Date(d.dateNaissance) : undefined,
    })),
  };
}

function parseTrancheEffectifs(tranche?: string): number | undefined {
  if (!tranche) return undefined;
  const map: Record<string, number> = {
    "00": 0, "01": 1, "02": 3, "03": 6,
    "11": 10, "12": 20, "21": 50, "22": 100,
    "31": 200, "32": 250, "41": 500, "42": 1000,
    "51": 2000, "52": 5000, "53": 10000,
  };
  return map[tranche] ?? undefined;
}

export type { INPICompany, INPISearchResult };
