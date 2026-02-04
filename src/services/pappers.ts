/**
 * Pappers API Client
 * Docs: https://www.pappers.fr/api/documentation
 */

interface PappersEntreprise {
  siren: string;
  siret_siege?: string;
  denomination?: string;
  nom_entreprise?: string;
  forme_juridique?: string;
  code_naf?: string;
  libelle_code_naf?: string;
  date_creation?: string;
  tranche_effectif?: string;
  effectif?: number;
  chiffre_affaires?: number;
  siege?: {
    siret?: string;
    adresse_ligne_1?: string;
    code_postal?: string;
    ville?: string;
    region?: string;
  };
  representants?: Array<{
    nom?: string;
    prenom?: string;
    qualite?: string;
    date_naissance?: string;
  }>;
  site_web?: string;
  telephone?: string;
}

const BASE_URL = "https://api.pappers.fr/v2";

function getApiKey(): string {
  const key = process.env.PAPPERS_API_KEY;
  if (!key) {
    throw new Error("PAPPERS_API_KEY not configured");
  }
  return key;
}

export async function getEntreprise(siren: string): Promise<PappersEntreprise | null> {
  const apiKey = getApiKey();

  const res = await fetch(`${BASE_URL}/entreprise?siren=${siren}&api_token=${apiKey}`);

  if (res.status === 404) return null;
  if (res.status === 402) {
    throw new Error("Pappers: credits exhausted");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Pappers fetch failed: ${res.status} - ${text}`);
  }

  return res.json();
}

export async function searchEntreprises(query: string, page = 1): Promise<{
  resultats: PappersEntreprise[];
  total: number;
}> {
  const apiKey = getApiKey();
  const params = new URLSearchParams({
    api_token: apiKey,
    q: query,
    page: String(page),
    par_page: "20",
  });

  const res = await fetch(`${BASE_URL}/recherche?${params}`);

  if (!res.ok) {
    throw new Error(`Pappers search failed: ${res.status}`);
  }

  return res.json();
}

export function parsePappersToProspectData(entreprise: PappersEntreprise) {
  const siege = entreprise.siege;
  return {
    siren: entreprise.siren,
    siret: siege?.siret || entreprise.siret_siege || undefined,
    companyName: entreprise.denomination || entreprise.nom_entreprise || undefined,
    legalForm: entreprise.forme_juridique || undefined,
    nafCode: entreprise.code_naf || undefined,
    nafLabel: entreprise.libelle_code_naf || undefined,
    creationDate: entreprise.date_creation ? new Date(entreprise.date_creation) : undefined,
    employeeCount: entreprise.effectif ?? undefined,
    revenue: entreprise.chiffre_affaires ?? undefined,
    website: entreprise.site_web || undefined,
    phone: entreprise.telephone || undefined,
    address: siege?.adresse_ligne_1 || undefined,
    postalCode: siege?.code_postal || undefined,
    city: siege?.ville || undefined,
    region: siege?.region || undefined,
    directors: (entreprise.representants || []).map((r) => ({
      firstName: r.prenom || undefined,
      lastName: r.nom || "Inconnu",
      role: r.qualite || undefined,
      birthDate: r.date_naissance ? new Date(r.date_naissance) : undefined,
    })),
  };
}

export type { PappersEntreprise };
