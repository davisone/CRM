import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// RGPD: Export all data for a prospect
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;

  const prospect = await prisma.prospect.findUnique({
    where: { id },
    include: {
      directors: true,
      activities: {
        include: { user: { select: { name: true } } },
      },
      statusHistory: true,
      enrichmentLogs: true,
    },
  });

  if (!prospect) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  // Return all data as JSON (RGPD data export)
  return new NextResponse(JSON.stringify(prospect, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="rgpd-export-${prospect.siren}.json"`,
    },
  });
}

// RGPD: Opt-out (ne plus contacter) or delete
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { action } = body; // "opt-out" or "delete"

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  if (action === "opt-out") {
    await prisma.$transaction([
      prisma.prospect.update({
        where: { id },
        data: {
          status: "NE_PLUS_CONTACTER",
          rgpdOptOut: true,
          rgpdOptOutDate: new Date(),
        },
      }),
      prisma.prospectStatusHistory.create({
        data: {
          prospectId: id,
          fromStatus: prospect.status,
          toStatus: "NE_PLUS_CONTACTER",
          reason: "Demande RGPD - Ne plus contacter",
          changedBy: session.user.id,
        },
      }),
      prisma.activity.create({
        data: {
          type: "CHANGEMENT_STATUT",
          title: "RGPD: Ne plus contacter",
          content: "Opt-out RGPD demandé",
          prospectId: id,
          userId: session.user.id,
        },
      }),
    ]);

    return NextResponse.json({ message: "Prospect marqué ne plus contacter (RGPD)" });
  }

  if (action === "delete") {
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Seul un admin peut supprimer (RGPD)" }, { status: 403 });
    }

    // Delete all related data
    await prisma.prospect.delete({ where: { id } });

    return NextResponse.json({ message: "Prospect et données associées supprimés (RGPD)" });
  }

  return NextResponse.json({ error: "Action invalide (opt-out ou delete)" }, { status: 400 });
}
