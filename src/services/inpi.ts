/**
 * INPI RNE API Client
 * API du Registre National des Entreprises
 * Auth: POST /api/sso/login avec username/password
 * Docs: https://registre-national-entreprises.inpi.fr/
 */

interface INPIAuthResponse {
  token: string;
}

// Structure réelle de la réponse API RNE
interface INPIRawCompany {
  id: string;
  updatedAt: string;
  formality: {
    siren: string;
    content: {
      natureCreation?: {
        dateCreation?: string;
        formeJuridique?: string;
      };
      personneMorale?: {
        identite?: {
          entreprise?: {
            siren?: string;
            denomination?: string;
            sigle?: string;
            formeJuridique?: string;
            codeApe?: string;
            dateImmat?: string;
          };
        };
        adresseEntreprise?: {
          adresse?: {
            numVoie?: string;
            typeVoie?: string;
            voie?: string;
            codePostal?: string;
            commune?: string;
            pays?: string;
          };
        };
        etablissementPrincipal?: {
          descriptionEtablissement?: {
            siret?: string;
            codeApe?: string;
          };
        };
      };
      personnePhysique?: {
        adresseEntreprise?: {
          adresse?: {
            numVoie?: string;
            typeVoie?: string;
            voie?: string;
            codePostal?: string;
            commune?: string;
          };
        };
        etablissementPrincipal?: {
          descriptionEtablissement?: {
            siret?: string;
            codeApe?: string;
          };
          activites?: Array<{
            codeApe?: string;
          }>;
        };
        identite?: {
          entrepreneur?: {
            nom?: string;
            prenoms?: string;
          };
        };
      };
    };
  };
}

// Structure normalisée pour notre CRM
export interface INPICompany {
  siren: string;
  siret?: string;
  denomination?: string;
  formeJuridique?: string;
  codeApe?: string;
  dateCreation?: string;
  adresse?: {
    numVoie?: string;
    typeVoie?: string;
    voie?: string;
    codePostal?: string;
    commune?: string;
  };
}

interface INPISearchResult {
  results: INPICompany[];
  totalResults: number;
  rawResults: INPIRawCompany[];
}

export interface INPISearchFilters {
  dateFrom?: string;
  dateTo?: string;
  nafCodes?: string[];
  departments?: string[];
  regions?: string[];
  legalForms?: string[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const BASE_URL = "https://registre-national-entreprises.inpi.fr/api";
const AUTH_URL = `${BASE_URL}/sso/login`;

async function authenticate(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const username = process.env.INPI_USERNAME;
  const password = process.env.INPI_PASSWORD;

  if (!username || !password) {
    throw new Error("INPI credentials not configured (INPI_USERNAME / INPI_PASSWORD)");
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`INPI auth failed: ${res.status} ${res.statusText} - ${errorText}`);
  }

  const data: INPIAuthResponse = await res.json();

  cachedToken = {
    token: data.token,
    expiresAt: Date.now() + 22 * 60 * 60 * 1000,
  };

  return data.token;
}

/**
 * Parse une réponse brute de l'API RNE vers notre structure normalisée
 */
function parseRawCompany(raw: INPIRawCompany): INPICompany {
  const f = raw.formality;
  const c = f.content;
  const pm = c.personneMorale;
  const pp = c.personnePhysique;

  // Personne morale (société)
  if (pm) {
    const entreprise = pm.identite?.entreprise;
    const addr = pm.adresseEntreprise?.adresse;
    const etab = pm.etablissementPrincipal?.descriptionEtablissement;

    return {
      siren: f.siren,
      siret: etab?.siret,
      denomination: entreprise?.denomination || entreprise?.sigle,
      formeJuridique: entreprise?.formeJuridique || c.natureCreation?.formeJuridique,
      codeApe: entreprise?.codeApe || etab?.codeApe,
      dateCreation: c.natureCreation?.dateCreation,
      adresse: addr ? {
        numVoie: addr.numVoie,
        typeVoie: addr.typeVoie,
        voie: addr.voie,
        codePostal: addr.codePostal,
        commune: addr.commune,
      } : undefined,
    };
  }

  // Personne physique (entrepreneur individuel)
  if (pp) {
    const ident = pp.identite?.entrepreneur;
    const addr = pp.adresseEntreprise?.adresse;
    const etab = pp.etablissementPrincipal;

    return {
      siren: f.siren,
      siret: etab?.descriptionEtablissement?.siret,
      denomination: ident ? `${ident.prenoms || ""} ${ident.nom || ""}`.trim() : undefined,
      formeJuridique: c.natureCreation?.formeJuridique,
      codeApe: etab?.descriptionEtablissement?.codeApe || etab?.activites?.[0]?.codeApe,
      dateCreation: c.natureCreation?.dateCreation,
      adresse: addr ? {
        numVoie: addr.numVoie,
        typeVoie: addr.typeVoie,
        voie: addr.voie,
        codePostal: addr.codePostal,
        commune: addr.commune,
      } : undefined,
    };
  }

  // Fallback minimal
  return {
    siren: f.siren,
    formeJuridique: c.natureCreation?.formeJuridique,
    dateCreation: c.natureCreation?.dateCreation,
  };
}

export async function searchNewCompanies(
  dateFrom: string,
  dateTo: string,
  page = 1,
  pageSize = 100
): Promise<INPISearchResult> {
  return searchCompaniesWithFilters({ dateFrom, dateTo }, page, pageSize);
}

export async function searchCompaniesWithFilters(
  filters: INPISearchFilters,
  page = 1,
  pageSize = 100
): Promise<INPISearchResult> {
  const token = await authenticate();

  const searchParams: Record<string, string> = {
    page: String(page),
    pageSize: String(pageSize),
    sort: "dateCreation:desc",
  };

  if (filters.dateFrom) {
    searchParams.dateCreationMin = filters.dateFrom;
  }
  if (filters.dateTo) {
    searchParams.dateTo = filters.dateTo;
  }
  if (filters.nafCodes && filters.nafCodes.length > 0) {
    searchParams.activitePrincipale = filters.nafCodes.join(",");
  }
  if (filters.departments && filters.departments.length > 0) {
    searchParams.codePostal = filters.departments.map(d => `${d}*`).join(",");
  }
  if (filters.legalForms && filters.legalForms.length > 0) {
    searchParams.formeJuridique = filters.legalForms.join(",");
  }

  const params = new URLSearchParams(searchParams);

  const res = await fetch(`${BASE_URL}/companies?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`INPI search failed: ${res.status} - ${text}`);
  }

  const rawResults: INPIRawCompany[] = await res.json();

  return {
    results: rawResults.map(parseRawCompany),
    totalResults: rawResults.length,
    rawResults,
  };
}

export async function getCompanyBySiren(siren: string): Promise<INPICompany | null> {
  const token = await authenticate();

  const res = await fetch(`${BASE_URL}/companies/${siren}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new Error(`INPI company fetch failed: ${res.status}`);
  }

  const raw: INPIRawCompany = await res.json();
  return parseRawCompany(raw);
}

/**
 * Convertit une entreprise INPI vers le format Prospect du CRM
 */
export function parseINPIToProspect(company: INPICompany) {
  const addr = company.adresse;

  return {
    siren: company.siren,
    siret: company.siret,
    companyName: company.denomination || `Entreprise ${company.siren}`,
    legalForm: company.formeJuridique,
    nafCode: company.codeApe,
    creationDate: company.dateCreation ? new Date(company.dateCreation) : undefined,
    address: addr
      ? [addr.numVoie, addr.typeVoie, addr.voie].filter(Boolean).join(" ")
      : undefined,
    postalCode: addr?.codePostal,
    city: addr?.commune,
    directors: [] as Array<{
      firstName?: string;
      lastName: string;
      role?: string;
      birthDate?: Date;
    }>,
  };
}

export type { INPISearchResult };
