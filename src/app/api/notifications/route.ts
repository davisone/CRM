import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const userId = session.user.id;
  const now = new Date();

  // Build notifications from different sources
  const notifications: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    link?: string;
    createdAt: string;
  }> = [];

  // 1. Overdue follow-ups
  const overdueFollowUps = await prisma.prospect.findMany({
    where: {
      ...(isAdmin ? {} : { assignedToId: userId }),
      nextFollowUpAt: { lt: now },
      status: { notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"] },
    },
    select: {
      id: true,
      companyName: true,
      nextFollowUpAt: true,
    },
    take: 10,
    orderBy: { nextFollowUpAt: "asc" },
  });

  for (const p of overdueFollowUps) {
    notifications.push({
      id: `overdue-${p.id}`,
      type: "OVERDUE_FOLLOWUP",
      title: "Relance en retard",
      description: `${p.companyName} - relance prévue le ${p.nextFollowUpAt?.toLocaleDateString("fr-FR")}`,
      link: `/prospects/${p.id}`,
      createdAt: p.nextFollowUpAt?.toISOString() || now.toISOString(),
    });
  }

  // 2. New prospects assigned today
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const newAssigned = await prisma.prospect.findMany({
    where: {
      assignedToId: userId,
      assignedAt: { gte: todayStart },
    },
    select: {
      id: true,
      companyName: true,
      score: true,
      assignedAt: true,
    },
    take: 5,
    orderBy: { assignedAt: "desc" },
  });

  for (const p of newAssigned) {
    notifications.push({
      id: `assigned-${p.id}`,
      type: "NEW_ASSIGNMENT",
      title: "Nouveau prospect assigné",
      description: `${p.companyName} (score: ${p.score})`,
      link: `/prospects/${p.id}`,
      createdAt: p.assignedAt?.toISOString() || now.toISOString(),
    });
  }

  // 3. For admin: failed import batches
  if (isAdmin) {
    const failedBatches = await prisma.importBatch.findMany({
      where: { status: "FAILED" },
      take: 5,
      orderBy: { startedAt: "desc" },
    });

    for (const b of failedBatches) {
      notifications.push({
        id: `batch-${b.id}`,
        type: "IMPORT_FAILED",
        title: "Import échoué",
        description: `Batch ${b.source} du ${b.startedAt.toLocaleDateString("fr-FR")}`,
        link: "/admin/monitoring",
        createdAt: b.startedAt.toISOString(),
      });
    }
  }

  // Sort by date desc
  notifications.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({
    notifications,
    unreadCount: notifications.length,
  });
}
