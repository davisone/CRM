/**
 * Scoring Job: scores prospects and auto-qualifies them
 */
import { prisma } from "@/lib/prisma";
import { scoreProspect } from "@/lib/scoring";
import type { PgBoss } from "pg-boss";

export interface ScoreJobData {
  prospectIds?: string[];
  batchId?: string;
  all?: boolean;
}

export async function scoreCompanies(boss: PgBoss, data: ScoreJobData) {
  const { batchId } = data;
  const qualifyThreshold = parseInt(process.env.SCORE_THRESHOLD_QUALIFY || "40");
  const autoQualify = process.env.AUTO_QUALIFY_ENABLED !== "false";

  // Load NAF sections for scoring context
  const nafSections = await prisma.nafSection.findMany();

  let prospects;
  if (data.prospectIds && data.prospectIds.length > 0) {
    prospects = await prisma.prospect.findMany({
      where: { id: { in: data.prospectIds } },
      include: {
        directors: {
          select: { email: true, phone: true },
        },
      },
    });
  } else if (data.all) {
    prospects = await prisma.prospect.findMany({
      where: {
        status: { in: ["NOUVEAU", "A_CONTACTER"] },
      },
      include: {
        directors: {
          select: { email: true, phone: true },
        },
      },
    });
  } else {
    return;
  }

  let scored = 0;
  let qualified = 0;
  const toAssign: string[] = [];

  for (const prospect of prospects) {
    const hasDirectorContact = prospect.directors.some(
      (d) => (d.email && d.email.length > 0) || (d.phone && d.phone.length > 0)
    );

    const { score, priority, details } = scoreProspect(prospect, {
      hasDirectorContact,
      nafSections,
    });

    await prisma.prospect.update({
      where: { id: prospect.id },
      data: {
        score,
        priority,
        scoringDetails: details as unknown as import("@prisma/client").Prisma.InputJsonValue,
      },
    });

    scored++;

    // Auto-qualify: if score >= threshold and still NOUVEAU, move to A_CONTACTER
    if (autoQualify && score >= qualifyThreshold && prospect.status === "NOUVEAU") {
      await prisma.prospect.update({
        where: { id: prospect.id },
        data: { status: "A_CONTACTER" },
      });

      await prisma.prospectStatusHistory.create({
        data: {
          prospectId: prospect.id,
          fromStatus: "NOUVEAU",
          toStatus: "A_CONTACTER",
          reason: `Auto-qualifié (score: ${score})`,
          changedBy: "SYSTEM",
        },
      });

      qualified++;
      toAssign.push(prospect.id);
    }
  }

  // Update batch stats
  if (batchId) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        scored: { increment: scored },
      },
    });
  }

  // Queue assignment for qualified prospects
  if (toAssign.length > 0) {
    await boss.send("assign-prospects", { prospectIds: toAssign, batchId });
  }

  console.log(`Scored ${scored} prospects, qualified ${qualified}, queued ${toAssign.length} for assignment`);
}
