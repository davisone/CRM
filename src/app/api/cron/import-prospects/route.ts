import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { searchCompaniesWithFilters, parseINPIToProspect } from "@/services/inpi";
import { IMPORT_CONFIG, getSearchFilters } from "@/config/import-filters";

// Sécurité : vérifier le token cron (Vercel envoie CRON_SECRET)
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // En dev, autoriser sans token
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (!cronSecret) {
    console.warn("CRON_SECRET not configured");
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(request: NextRequest) {
  // Vérification auth
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  // Vérifier si l'import est activé
  if (!IMPORT_CONFIG.enabled) {
    return NextResponse.json({
      success: true,
      message: "Import désactivé dans la configuration",
      imported: 0,
    });
  }

  const startTime = Date.now();

  try {
    // Créer le batch d'import
    const importBatch = await prisma.importBatch.create({
      data: {
        source: "INPI_RNE_CRON",
        status: "IN_PROGRESS",
      },
    });

    const filters = getSearchFilters();
    console.log("[CRON] Recherche INPI avec filtres:", filters);

    // Rechercher les entreprises
    const searchResult = await searchCompaniesWithFilters(
      filters,
      1,
      IMPORT_CONFIG.maxProspectsPerRun
    );

    const companies = searchResult.results || [];
    console.log(`[CRON] ${companies.length} entreprises trouvées sur ${searchResult.totalResults} total`);

    let newInserted = 0;
    let duplicatesSkipped = 0;
    let errors = 0;
    const errorDetails: Array<{ siren: string; error: string }> = [];

    // Traiter chaque entreprise
    for (const company of companies) {
      try {
        const prospectData = parseINPIToProspect(company);

        // Vérifier si le SIREN existe déjà
        const existing = await prisma.prospect.findUnique({
          where: { siren: prospectData.siren },
          select: { id: true },
        });

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        // Créer le prospect avec ses dirigeants
        const directors = prospectData.directors || [];

        await prisma.prospect.create({
          data: {
            siren: prospectData.siren,
            siret: prospectData.siret,
            companyName: prospectData.companyName,
            legalForm: prospectData.legalForm,
            nafCode: prospectData.nafCode,
            creationDate: prospectData.creationDate,
            address: prospectData.address,
            postalCode: prospectData.postalCode,
            city: prospectData.city,
            status: "NOUVEAU",
            importBatchId: importBatch.id,
            directors: {
              create: directors.map((d) => ({
                firstName: d.firstName,
                lastName: d.lastName,
                role: d.role,
                birthDate: d.birthDate,
              })),
            },
          },
        });

        newInserted++;
      } catch (err) {
        errors++;
        errorDetails.push({
          siren: company.siren,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Mettre à jour le batch
    await prisma.importBatch.update({
      where: { id: importBatch.id },
      data: {
        status: "COMPLETED",
        totalFound: searchResult.totalResults,
        newInserted,
        duplicatesSkipped,
        errors,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
        completedAt: new Date(),
      },
    });

    const duration = Date.now() - startTime;

    console.log(`[CRON] Import terminé en ${duration}ms: ${newInserted} nouveaux, ${duplicatesSkipped} doublons, ${errors} erreurs`);

    return NextResponse.json({
      success: true,
      batchId: importBatch.id,
      totalFound: searchResult.totalResults,
      newInserted,
      duplicatesSkipped,
      errors,
      duration: `${duration}ms`,
    });
  } catch (error) {
    console.error("[CRON] Erreur import:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
