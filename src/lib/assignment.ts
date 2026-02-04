import { prisma } from "./prisma";
import type { UserRole } from "@prisma/client";

interface AssignableUser {
  id: string;
  name: string;
  role: UserRole;
  maxProspects: number;
  _count: { prospects: number };
}

export async function assignProspect(
  prospectId: string,
  score: number
): Promise<string | null> {
  const targetRole: UserRole = score >= 70 ? "COMMERCIAL" : "TELEPROSPECTEUR";

  const users = await prisma.user.findMany({
    where: {
      role: targetRole,
      isActive: true,
    },
    include: {
      _count: {
        select: {
          prospects: {
            where: {
              status: {
                notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"],
              },
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (users.length === 0) {
    // Fallback: try the other role
    const fallbackUsers = await prisma.user.findMany({
      where: {
        role: score >= 70 ? "TELEPROSPECTEUR" : "COMMERCIAL",
        isActive: true,
      },
      include: {
        _count: {
          select: {
            prospects: {
              where: {
                status: {
                  notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"],
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (fallbackUsers.length === 0) return null;
    return selectBestUser(fallbackUsers as AssignableUser[], prospectId);
  }

  return selectBestUser(users as AssignableUser[], prospectId);
}

async function selectBestUser(
  users: AssignableUser[],
  prospectId: string
): Promise<string | null> {
  // Filter out users who have reached their max capacity
  const available = users.filter(
    (u) => u._count.prospects < u.maxProspects
  );

  if (available.length === 0) return null;

  // Round-robin: pick the user with the fewest active prospects
  available.sort((a, b) => a._count.prospects - b._count.prospects);
  const selectedUser = available[0];

  await prisma.prospect.update({
    where: { id: prospectId },
    data: {
      assignedToId: selectedUser.id,
      assignedAt: new Date(),
    },
  });

  return selectedUser.id;
}
