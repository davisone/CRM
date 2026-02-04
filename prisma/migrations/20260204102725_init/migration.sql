-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'COMMERCIAL', 'TELEPROSPECTEUR');

-- CreateEnum
CREATE TYPE "ProspectStatus" AS ENUM ('NOUVEAU', 'A_CONTACTER', 'CONTACTE', 'INTERESSE', 'A_RELANCER', 'CLIENT', 'NON_INTERESSE', 'PERDU', 'NE_PLUS_CONTACTER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('APPEL', 'EMAIL', 'NOTE', 'RELANCE', 'CHANGEMENT_STATUT', 'ENRICHISSEMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TELEPROSPECTEUR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxProspects" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospects" (
    "id" TEXT NOT NULL,
    "siren" TEXT NOT NULL,
    "siret" TEXT,
    "companyName" TEXT NOT NULL,
    "legalForm" TEXT,
    "nafCode" TEXT,
    "nafLabel" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "region" TEXT,
    "creationDate" TIMESTAMP(3),
    "employeeCount" INTEGER,
    "revenue" DOUBLE PRECISION,
    "website" TEXT,
    "websiteQuality" INTEGER,
    "phone" TEXT,
    "email" TEXT,
    "googleRating" DOUBLE PRECISION,
    "googlePlaceId" TEXT,
    "hasGooglePresence" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoringDetails" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" "ProspectStatus" NOT NULL DEFAULT 'NOUVEAU',
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "importBatchId" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "followUpNote" TEXT,
    "rgpdOptOut" BOOLEAN NOT NULL DEFAULT false,
    "rgpdOptOutDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prospects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "directors" (
    "id" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT NOT NULL,
    "role" TEXT,
    "birthDate" TIMESTAMP(3),
    "phone" TEXT,
    "email" TEXT,
    "linkedin" TEXT,
    "prospectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "directors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB,
    "prospectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prospect_status_history" (
    "id" TEXT NOT NULL,
    "fromStatus" "ProspectStatus",
    "toStatus" "ProspectStatus" NOT NULL,
    "reason" TEXT,
    "prospectId" TEXT NOT NULL,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prospect_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrichment_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "endpoint" TEXT,
    "success" BOOLEAN NOT NULL,
    "httpStatus" INTEGER,
    "responseMs" INTEGER,
    "error" TEXT,
    "dataKeys" TEXT[],
    "creditsUsed" INTEGER NOT NULL DEFAULT 0,
    "prospectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "enrichment_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INPI',
    "totalFound" INTEGER NOT NULL DEFAULT 0,
    "newInserted" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "enriched" INTEGER NOT NULL DEFAULT 0,
    "scored" INTEGER NOT NULL DEFAULT 0,
    "assigned" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorDetails" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "naf_sections" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "scoreBonus" INTEGER NOT NULL DEFAULT 0,
    "isHighValue" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "naf_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "prospects_siren_key" ON "prospects"("siren");

-- CreateIndex
CREATE INDEX "prospects_status_idx" ON "prospects"("status");

-- CreateIndex
CREATE INDEX "prospects_assignedToId_idx" ON "prospects"("assignedToId");

-- CreateIndex
CREATE INDEX "prospects_score_idx" ON "prospects"("score");

-- CreateIndex
CREATE INDEX "prospects_postalCode_idx" ON "prospects"("postalCode");

-- CreateIndex
CREATE INDEX "prospects_nafCode_idx" ON "prospects"("nafCode");

-- CreateIndex
CREATE INDEX "prospects_nextFollowUpAt_idx" ON "prospects"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "activities_prospectId_idx" ON "activities"("prospectId");

-- CreateIndex
CREATE INDEX "activities_userId_idx" ON "activities"("userId");

-- CreateIndex
CREATE INDEX "activities_scheduledAt_idx" ON "activities"("scheduledAt");

-- CreateIndex
CREATE INDEX "prospect_status_history_prospectId_idx" ON "prospect_status_history"("prospectId");

-- CreateIndex
CREATE INDEX "enrichment_logs_prospectId_idx" ON "enrichment_logs"("prospectId");

-- CreateIndex
CREATE INDEX "enrichment_logs_source_idx" ON "enrichment_logs"("source");

-- CreateIndex
CREATE UNIQUE INDEX "naf_sections_code_key" ON "naf_sections"("code");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "directors" ADD CONSTRAINT "directors_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prospect_status_history" ADD CONSTRAINT "prospect_status_history_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrichment_logs" ADD CONSTRAINT "enrichment_logs_prospectId_fkey" FOREIGN KEY ("prospectId") REFERENCES "prospects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
