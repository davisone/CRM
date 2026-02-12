import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createProspectSchema } from "@/lib/validations";
import type { Prisma } from "@prisma/client";
import { Pool } from "pg";

/**
 * Queue a job by inserting directly into pg-boss tables.
 */
async function sendJob(name: string, data: Record<string, unknown>) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    await pool.query(
      `INSERT INTO pgboss.job (name, data, state, retrylimit, retrydelay, expirein)
       VALUES ($1, $2, 'created', 3, 30, interval '24 hours')`,
      [name, JSON.stringify(data)]
    );
  } finally {
    await pool.end();
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const assignedToId = searchParams.get("assignedToId") || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
  const minScore = searchParams.get("minScore");
  const maxScore = searchParams.get("maxScore");
  const followUp = searchParams.get("followUp");
  const followUpFrom = searchParams.get("followUpFrom");
  const followUpTo = searchParams.get("followUpTo");

  const where: Prisma.ProspectWhereInput = {};

  if (search) {
    where.OR = [
      { companyName: { contains: search, mode: "insensitive" } },
      { siren: { contains: search } },
      { city: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status) {
    where.status = status as Prisma.EnumProspectStatusFilter;
  }

  if (assignedToId) {
    where.assignedToId = assignedToId;
  }

  if (minScore) {
    where.score = { ...((where.score as object) || {}), gte: parseInt(minScore) };
  }
  if (maxScore) {
    where.score = { ...((where.score as object) || {}), lte: parseInt(maxScore) };
  }

  if (followUp === "1") {
    if (followUpFrom || followUpTo) {
      where.nextFollowUpAt = {
        ...(followUpFrom ? { gte: new Date(followUpFrom) } : {}),
        ...(followUpTo ? { lte: new Date(followUpTo) } : {}),
      };
    } else {
      where.nextFollowUpAt = { not: null };
    }
    if (!status) {
      where.status = {
        notIn: ["CLIENT", "PERDU", "NE_PLUS_CONTACTER"],
      } as Prisma.EnumProspectStatusFilter;
    }
  }

  // Non-admin users only see their assigned prospects
  if (session.user.role !== "ADMIN") {
    where.assignedToId = session.user.id;
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, name: true, role: true } },
        _count: { select: { activities: true, directors: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.prospect.count({ where }),
  ]);

  return NextResponse.json({
    prospects,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createProspectSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Données invalides", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Check for duplicate SIREN
  const existing = await prisma.prospect.findUnique({
    where: { siren: parsed.data.siren },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Un prospect avec ce SIREN existe déjà" },
      { status: 409 }
    );
  }

  const prospect = await prisma.prospect.create({
    data: parsed.data,
  });

  // Create initial status history
  await prisma.prospectStatusHistory.create({
    data: {
      prospectId: prospect.id,
      toStatus: "NOUVEAU",
      changedBy: session.user.id,
    },
  });

  // Auto-trigger enrichment job (INSEE, Pappers, Google Places)
  try {
    await sendJob("enrich-company", { prospectId: prospect.id });
  } catch (err) {
    // Log but don't fail the creation if job queueing fails
    console.error("Failed to queue enrichment job:", err);
  }

  return NextResponse.json(prospect, { status: 201 });
}
