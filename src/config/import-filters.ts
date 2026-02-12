import { INPISearchFilters } from "@/services/inpi";

/**
 * Configuration des filtres pour l'import automatique des prospects
 * Modifie ces valeurs selon tes critères de prospection
 */
export const IMPORT_CONFIG = {
  // Activer/désactiver l'import automatique
  enabled: true,

  // Nombre de jours en arrière pour chercher les nouvelles entreprises
  daysBack: 7,

  // Nombre max de prospects à importer par exécution du cron
  maxProspectsPerRun: 100,

  // Filtres de recherche INPI
  filters: {
    // Codes NAF ciblés (laisse vide pour tous les secteurs)
    // Exemples:
    // - "62.01Z" : Programmation informatique
    // - "62.02A" : Conseil en systèmes informatiques
    // - "70.22Z" : Conseil pour les affaires
    // - "73.11Z" : Activités des agences de publicité
    nafCodes: [
      // "62.01Z",
      // "62.02A",
      // "70.22Z",
    ],

    // Départements ciblés (laisse vide pour toute la France)
    // Exemples: ["75", "92", "93", "94"] pour Paris + Petite Couronne
    departments: [
      // "35", // Ille-et-Vilaine
      // "75", // Paris
    ],

    // Formes juridiques ciblées (laisse vide pour toutes)
    // Exemples:
    // - "5710" : SAS
    // - "5720" : SASU
    // - "5499" : SARL
    legalForms: [
      // "5710",
      // "5720",
    ],
  } satisfies Partial<INPISearchFilters>,
};

/**
 * Génère les filtres de recherche avec les dates calculées
 */
export function getSearchFilters(): INPISearchFilters {
  const now = new Date();
  const dateFrom = new Date(now);
  dateFrom.setDate(dateFrom.getDate() - IMPORT_CONFIG.daysBack);

  return {
    dateFrom: dateFrom.toISOString().split("T")[0],
    dateTo: now.toISOString().split("T")[0],
    nafCodes: IMPORT_CONFIG.filters.nafCodes.length > 0
      ? IMPORT_CONFIG.filters.nafCodes
      : undefined,
    departments: IMPORT_CONFIG.filters.departments.length > 0
      ? IMPORT_CONFIG.filters.departments
      : undefined,
    legalForms: IMPORT_CONFIG.filters.legalForms.length > 0
      ? IMPORT_CONFIG.filters.legalForms
      : undefined,
  };
}
