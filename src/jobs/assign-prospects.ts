/**
 * Assignment Job: auto-assigns prospects to users via round-robin
 */
import { prisma } from "@/lib/prisma";
import { assignProspect } from "@/lib/assignment";

export interface AssignJobData {
  prospectIds: string[];
  batchId?: string;
}

export async function assignProspects(data: AssignJobData) {
  const { prospectIds, batchId } = data;
  const autoAssign = process.env.AUTO_ASSIGN_ENABLED !== "false";

  if (!autoAssign) {
    console.log("Auto-assignment disabled, skipping");
    return;
  }

  let assigned = 0;

  for (const prospectId of prospectIds) {
    const prospect = await prisma.prospect.findUnique({
      where: { id: prospectId },
      select: { id: true, score: true, assignedToId: true, status: true },
    });

    if (!prospect) continue;
    if (prospect.assignedToId) continue; // Already assigned
    if (!["A_CONTACTER", "NOUVEAU"].includes(prospect.status)) continue;

    const userId = await assignProspect(prospectId, prospect.score);

    if (userId) {
      assigned++;

      // Log the assignment
      await prisma.activity.create({
        data: {
          type: "CHANGEMENT_STATUT",
          title: "Assignation automatique",
          content: `Prospect assigné automatiquement (score: ${prospect.score})`,
          prospectId,
          userId,
          metadata: { autoAssigned: true, score: prospect.score },
        },
      });
    }
  }

  // Update batch stats
  if (batchId) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { assigned: { increment: assigned } },
    });
  }

  console.log(`Assigned ${assigned} of ${prospectIds.length} prospects`);
}
