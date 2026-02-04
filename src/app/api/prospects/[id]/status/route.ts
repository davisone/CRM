import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { statusTransitionSchema } from "@/lib/validations";

const VALID_TRANSITIONS: Record<string, string[]> = {
  NOUVEAU: ["A_CONTACTER", "NE_PLUS_CONTACTER"],
  A_CONTACTER: ["CONTACTE", "NE_PLUS_CONTACTER"],
  CONTACTE: ["INTERESSE", "NON_INTERESSE", "A_RELANCER", "NE_PLUS_CONTACTER"],
  INTERESSE: ["A_RELANCER", "CLIENT", "NON_INTERESSE", "NE_PLUS_CONTACTER"],
  A_RELANCER: ["CONTACTE", "INTERESSE", "NON_INTERESSE", "NE_PLUS_CONTACTER"],
  NON_INTERESSE: ["PERDU", "A_RELANCER", "NE_PLUS_CONTACTER"],
  CLIENT: ["NE_PLUS_CONTACTER"],
  PERDU: ["A_CONTACTER", "NE_PLUS_CONTACTER"],
  NE_PLUS_CONTACTER: [],
};

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
  const parsed = statusTransitionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const prospect = await prisma.prospect.findUnique({ where: { id } });
  if (!prospect) {
    return NextResponse.json({ error: "Prospect introuvable" }, { status: 404 });
  }

  const validNextStatuses = VALID_TRANSITIONS[prospect.status] || [];
  // Admin can force any transition
  if (session.user.role !== "ADMIN" && !validNextStatuses.includes(parsed.data.status)) {
    return NextResponse.json(
      {
        error: `Transition invalide: ${prospect.status} → ${parsed.data.status}`,
        validTransitions: validNextStatuses,
      },
      { status: 400 }
    );
  }

  // Update prospect status and create history entry
  const [updatedProspect] = await prisma.$transaction([
    prisma.prospect.update({
      where: { id },
      data: {
        status: parsed.data.status,
        ...(parsed.data.status === "NE_PLUS_CONTACTER" && {
          rgpdOptOut: true,
          rgpdOptOutDate: new Date(),
        }),
      },
    }),
    prisma.prospectStatusHistory.create({
      data: {
        prospectId: id,
        fromStatus: prospect.status,
        toStatus: parsed.data.status,
        reason: parsed.data.reason,
        changedBy: session.user.id,
      },
    }),
    prisma.activity.create({
      data: {
        type: "CHANGEMENT_STATUT",
        title: `Statut: ${prospect.status} → ${parsed.data.status}`,
        content: parsed.data.reason,
        prospectId: id,
        userId: session.user.id,
        metadata: {
          fromStatus: prospect.status,
          toStatus: parsed.data.status,
        },
      },
    }),
  ]);

  return NextResponse.json(updatedProspect);
}
