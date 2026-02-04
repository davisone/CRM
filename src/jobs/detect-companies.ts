/**
 * Detection Job: queries INPI for new companies, deduplicates, inserts, queues enrichment
 */
import { prisma } from "@/lib/prisma";
import { searchNewCompanies, parseINPIToProspect } from "@/services/inpi";
import type { PgBoss } from "pg-boss";

export interface DetectJobData {
  dateFrom?: string;
  dateTo?: string;
  batchId?: string;
}

export async function detectCompanies(boss: PgBoss, data: DetectJobData) {
  const now = new Date();
  const dateFrom =
    data.dateFrom ||
    new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const dateTo = data.dateTo || now.toISOString().split("T")[0];

  // Create an import batch
  const batch = data.batchId
    ? await prisma.importBatch.findUnique({ where: { id: data.batchId } })
    : await prisma.importBatch.create({
        data: { source: "INPI", status: "RUNNING" },
      });

  if (!batch) throw new Error("Could not create/find import batch");

  if (!data.batchId) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: { status: "RUNNING" },
    });
  }

  let totalFound = 0;
  let newInserted = 0;
  let duplicatesSkipped = 0;
  let errors = 0;
  let page = 1;
  let hasMore = true;

  try {
    while (hasMore) {
      const result = await searchNewCompanies(dateFrom, dateTo, page, 100);
      totalFound += result.results.length;

      for (const company of result.results) {
        try {
          // Check for duplicate
          const existing = await prisma.prospect.findUnique({
            where: { siren: company.siren },
          });

          if (existing) {
            duplicatesSkipped++;
            continue;
          }

          // Parse and insert
          const parsed = parseINPIToProspect(company);
          const { directors, ...prospectData } = parsed;

          const prospect = await prisma.prospect.create({
            data: {
              ...prospectData,
              importBatchId: batch.id,
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

          // Create initial status history
          await prisma.prospectStatusHistory.create({
            data: {
              prospectId: prospect.id,
              toStatus: "NOUVEAU",
              changedBy: "SYSTEM",
            },
          });

          newInserted++;

          // Queue enrichment job
          await boss.send("enrich-company", {
            prospectId: prospect.id,
            batchId: batch.id,
          });
        } catch (err) {
          errors++;
          console.error(`Error processing SIREN ${company.siren}:`, err);
        }
      }

      hasMore = result.results.length === 100;
      page++;
    }

    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        totalFound,
        newInserted,
        duplicatesSkipped,
        errors,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });

    console.log(
      `Detection complete: ${totalFound} found, ${newInserted} new, ${duplicatesSkipped} dupes, ${errors} errors`
    );
  } catch (err) {
    await prisma.importBatch.update({
      where: { id: batch.id },
      data: {
        totalFound,
        newInserted,
        duplicatesSkipped,
        errors,
        status: "FAILED",
        errorDetails: { message: String(err) },
        completedAt: new Date(),
      },
    });
    throw err;
  }

  return batch.id;
}
