import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Pool } from "pg";

/**
 * Queue a job by inserting directly into pg-boss tables.
 * This avoids importing pg-boss in the Next.js bundle (CJS/ESM issues).
 * The worker process picks up these jobs.
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

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const [importBatches, enrichmentStats, recentLogs] = await Promise.all([
    prisma.importBatch.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.enrichmentLog.groupBy({
      by: ["source", "success"],
      _count: true,
      _avg: { responseMs: true },
    }),
    prisma.enrichmentLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        prospect: { select: { companyName: true, siren: true } },
      },
    }),
  ]);

  // Aggregate enrichment stats by source
  const sourceStats: Record<string, { total: number; success: number; failed: number; avgMs: number }> = {};
  for (const stat of enrichmentStats) {
    if (!sourceStats[stat.source]) {
      sourceStats[stat.source] = { total: 0, success: 0, failed: 0, avgMs: 0 };
    }
    const s = sourceStats[stat.source];
    s.total += stat._count;
    if (stat.success) {
      s.success += stat._count;
    } else {
      s.failed += stat._count;
    }
    s.avgMs = stat._avg.responseMs || 0;
  }

  return NextResponse.json({
    importBatches,
    enrichmentStats: sourceStats,
    recentLogs,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  try {
    switch (action) {
      case "detect": {
        const batch = await prisma.importBatch.create({
          data: { source: "INPI_MANUAL", status: "PENDING" },
        });
        await sendJob("detect-companies", {
          batchId: batch.id,
          dateFrom: body.dateFrom,
          dateTo: body.dateTo,
        });
        return NextResponse.json({ message: "Détection lancée", batchId: batch.id });
      }
      case "score-all": {
        await sendJob("score-companies", { all: true });
        return NextResponse.json({ message: "Scoring global lancé" });
      }
      case "enrich": {
        if (!body.prospectId) {
          return NextResponse.json({ error: "prospectId requis" }, { status: 400 });
        }
        await sendJob("enrich-company", { prospectId: body.prospectId });
        return NextResponse.json({ message: "Enrichissement lancé" });
      }
      default:
        return NextResponse.json({ error: "Action inconnue" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Erreur: ${String(err)}` },
      { status: 500 }
    );
  }
}
