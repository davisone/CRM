/**
 * Enrichment Job: enriches a single prospect from multiple sources sequentially
 * Flow: INSEE -> Pappers -> Google Places
 */
import { prisma } from "@/lib/prisma";
import { getUniteLegaleBySiren, searchSiegeParSiren, parseINSEEToProspectData } from "@/services/insee";
import { getEntreprise, parsePappersToProspectData } from "@/services/pappers";
import { searchCompany, parseGoogleToProspectData } from "@/services/google-places";
import type { PgBoss } from "pg-boss";

export interface EnrichJobData {
  prospectId: string;
  batchId?: string;
}

async function logEnrichment(
  prospectId: string,
  source: string,
  endpoint: string,
  success: boolean,
  startTime: number,
  dataKeys: string[] = [],
  creditsUsed = 0,
  error?: string,
  httpStatus?: number
) {
  await prisma.enrichmentLog.create({
    data: {
      prospectId,
      source,
      endpoint,
      success,
      responseMs: Date.now() - startTime,
      dataKeys,
      creditsUsed,
      error: error?.substring(0, 500),
      httpStatus,
    },
  });
}

export async function enrichCompany(boss: PgBoss, data: EnrichJobData) {
  const { prospectId, batchId } = data;

  const prospect = await prisma.prospect.findUnique({ where: { id: prospectId } });
  if (!prospect) {
    console.error(`Prospect ${prospectId} not found, skipping enrichment`);
    return;
  }

  const updateData: Record<string, unknown> = {};

  // ---- 1. INSEE ----
  if (process.env.INSEE_CLIENT_ID && process.env.INSEE_CLIENT_SECRET) {
    let start = Date.now();
    try {
      const uniteLegale = await getUniteLegaleBySiren(prospect.siren);
      if (uniteLegale) {
        const siege = await searchSiegeParSiren(prospect.siren);
        const inseeData = parseINSEEToProspectData(uniteLegale, siege);
        const keys = Object.keys(inseeData).filter(
          (k) => inseeData[k as keyof typeof inseeData] !== undefined
        );
        Object.assign(updateData, inseeData);
        await logEnrichment(prospectId, "INSEE", "siren+siege", true, start, keys);
      } else {
        await logEnrichment(prospectId, "INSEE", "siren", true, start, [], 0, "Not found");
      }
    } catch (err) {
      await logEnrichment(prospectId, "INSEE", "siren", false, start, [], 0, String(err));
    }
  }

  // ---- 2. Pappers ----
  if (process.env.PAPPERS_API_KEY) {
    let start = Date.now();
    try {
      const entreprise = await getEntreprise(prospect.siren);
      if (entreprise) {
        const pappersData = parsePappersToProspectData(entreprise);
        const { directors, ...fields } = pappersData;
        const keys = Object.keys(fields).filter(
          (k) => fields[k as keyof typeof fields] !== undefined
        );
        // Pappers data takes precedence for overlapping fields
        Object.assign(updateData, fields);

        // Upsert directors
        if (directors.length > 0) {
          for (const dir of directors) {
            const existing = await prisma.director.findFirst({
              where: {
                prospectId,
                lastName: dir.lastName,
                firstName: dir.firstName || null,
              },
            });
            if (!existing) {
              await prisma.director.create({
                data: { ...dir, prospectId },
              });
            }
          }
        }

        await logEnrichment(prospectId, "PAPPERS", "entreprise", true, start, keys, 1);
      } else {
        await logEnrichment(prospectId, "PAPPERS", "entreprise", true, start, [], 1, "Not found");
      }
    } catch (err) {
      const isPaid = String(err).includes("credits");
      await logEnrichment(
        prospectId, "PAPPERS", "entreprise", false, start, [],
        isPaid ? 0 : 1, String(err)
      );
    }
  }

  // ---- 3. Google Places ----
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const start = Date.now();
    try {
      const companyName = (updateData.companyName as string) || prospect.companyName;
      const city = (updateData.city as string) || prospect.city || undefined;
      const { place, creditsUsed } = await searchCompany(companyName, city);

      if (place) {
        const googleData = parseGoogleToProspectData(place);
        const keys = Object.keys(googleData).filter(
          (k) => googleData[k as keyof typeof googleData] !== undefined
        );
        // Only override website/phone if not already set
        if (!updateData.website && googleData.website) {
          updateData.website = googleData.website;
        }
        if (!updateData.phone && googleData.phone) {
          updateData.phone = googleData.phone;
        }
        updateData.googlePlaceId = googleData.googlePlaceId;
        updateData.hasGooglePresence = googleData.hasGooglePresence;
        updateData.googleRating = googleData.googleRating;

        await logEnrichment(prospectId, "GOOGLE_PLACES", "text_search+details", true, start, keys, creditsUsed);
      } else {
        await logEnrichment(prospectId, "GOOGLE_PLACES", "text_search", true, start, [], 1, "No results");
      }
    } catch (err) {
      await logEnrichment(prospectId, "GOOGLE_PLACES", "text_search", false, Date.now(), [], 1, String(err));
    }
  }

  // ---- Apply all enrichment data ----
  if (Object.keys(updateData).length > 0) {
    await prisma.prospect.update({
      where: { id: prospectId },
      data: updateData,
    });
  }

  // ---- Create enrichment activity ----
  await prisma.activity.create({
    data: {
      type: "ENRICHISSEMENT",
      title: "Enrichissement automatique",
      content: `Sources: ${[
        process.env.INSEE_CLIENT_ID ? "INSEE" : null,
        process.env.PAPPERS_API_KEY ? "Pappers" : null,
        process.env.GOOGLE_PLACES_API_KEY ? "Google Places" : null,
      ]
        .filter(Boolean)
        .join(", ")}`,
      prospectId,
      userId: "SYSTEM",
      metadata: { enrichedFields: Object.keys(updateData) },
    },
  });

  // Update batch stats
  if (batchId) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { enriched: { increment: 1 } },
    });
  }

  // Queue scoring
  await boss.send("score-companies", { prospectIds: [prospectId], batchId });

  console.log(`Enriched prospect ${prospectId}: ${Object.keys(updateData).length} fields updated`);
}
