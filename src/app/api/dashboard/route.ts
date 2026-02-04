import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const isAdmin = session.user.role === "ADMIN";
  const userFilter = isAdmin ? {} : { assignedToId: session.user.id };

  const [
    totalProspects,
    statusCounts,
    recentProspects,
    upcomingFollowUps,
    recentActivities,
    priorityCounts,
  ] = await Promise.all([
    prisma.prospect.count({ where: userFilter }),
    prisma.prospect.groupBy({
      by: ["status"],
      _count: true,
      where: userFilter,
    }),
    prisma.prospect.findMany({
      where: userFilter,
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        companyName: true,
        status: true,
        score: true,
        city: true,
        createdAt: true,
      },
    }),
    prisma.prospect.findMany({
      where: {
        ...userFilter,
        nextFollowUpAt: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          gte: new Date(),
        },
        status: {
          notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"],
        },
      },
      orderBy: { nextFollowUpAt: "asc" },
      take: 10,
      select: {
        id: true,
        companyName: true,
        status: true,
        nextFollowUpAt: true,
        followUpNote: true,
        assignedTo: { select: { name: true } },
      },
    }),
    prisma.activity.findMany({
      where: isAdmin ? {} : { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { name: true } },
        prospect: { select: { id: true, companyName: true } },
      },
    }),
    prisma.prospect.groupBy({
      by: ["priority"],
      _count: true,
      where: {
        ...userFilter,
        status: { notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"] },
      },
    }),
  ]);

  const statusMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count])
  );

  return NextResponse.json({
    totalProspects,
    statusCounts: statusMap,
    priorityCounts: Object.fromEntries(
      priorityCounts.map((p) => [p.priority, p._count])
    ),
    aContacter: statusMap.A_CONTACTER || 0,
    enCours:
      (statusMap.CONTACTE || 0) +
      (statusMap.INTERESSE || 0) +
      (statusMap.A_RELANCER || 0),
    clients: statusMap.CLIENT || 0,
    recentProspects,
    upcomingFollowUps,
    recentActivities,
  });
}
