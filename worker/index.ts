/**
 * pg-boss Worker Process
 * Runs as a separate container, handles all background jobs
 */
import "dotenv/config";
import { PgBoss } from "pg-boss";
import { detectCompanies, type DetectJobData } from "../src/jobs/detect-companies";
import { enrichCompany, type EnrichJobData } from "../src/jobs/enrich-company";
import { scoreCompanies, type ScoreJobData } from "../src/jobs/score-companies";
import { assignProspects, type AssignJobData } from "../src/jobs/assign-prospects";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function main() {
  console.log("Starting pg-boss worker...");

  const boss = new PgBoss({
    connectionString: DATABASE_URL!,
  });

  boss.on("error", (err) => console.error("pg-boss error:", err));

  await boss.start();
  console.log("pg-boss started successfully");

  // ---- Register job handlers ----

  // Detection: runs on schedule or manually triggered
  await boss.work<DetectJobData>(
    "detect-companies",
    { localConcurrency: 1 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[detect-companies] Starting job ${job.id}`);
        await detectCompanies(boss, job.data);
        console.log(`[detect-companies] Completed job ${job.id}`);
      }
    }
  );

  // Enrichment: max 3 concurrent per the plan
  await boss.work<EnrichJobData>(
    "enrich-company",
    { localConcurrency: 3 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[enrich-company] Starting job ${job.id} for prospect ${job.data.prospectId}`);
        await enrichCompany(boss, job.data);
        console.log(`[enrich-company] Completed job ${job.id}`);
      }
    }
  );

  // Scoring: batch scoring
  await boss.work<ScoreJobData>(
    "score-companies",
    { localConcurrency: 1 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[score-companies] Starting job ${job.id}`);
        await scoreCompanies(boss, job.data);
        console.log(`[score-companies] Completed job ${job.id}`);
      }
    }
  );

  // Assignment: assign prospects to users
  await boss.work<AssignJobData>(
    "assign-prospects",
    { localConcurrency: 1 },
    async (jobs) => {
      for (const job of jobs) {
        console.log(`[assign-prospects] Starting job ${job.id}`);
        await assignProspects(job.data);
        console.log(`[assign-prospects] Completed job ${job.id}`);
      }
    }
  );

  // ---- Schedule recurring jobs ----

  // Detection CRON: every day at 6:00 AM
  await boss.schedule("detect-companies", "0 6 * * *", {}, {
    tz: "Europe/Paris",
  });

  console.log("All job handlers registered. Worker is ready.");
  console.log("Scheduled: detect-companies at 0 6 * * * (Europe/Paris)");

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down worker...");
    await boss.stop({ graceful: true, timeout: 30000 });
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Worker failed to start:", err);
  process.exit(1);
});
