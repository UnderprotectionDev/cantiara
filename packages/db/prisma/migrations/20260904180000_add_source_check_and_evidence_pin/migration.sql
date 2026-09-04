-- CreateTable
CREATE TABLE IF NOT EXISTS "source_check" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "startUrl" TEXT NOT NULL,
    "finalUrl" TEXT,
    "httpResult" TEXT NOT NULL,
    "contentType" TEXT,
    "fingerprint" TEXT,
    "failureReason" TEXT,
    "candidateTitle" TEXT,
    "candidateContent" TEXT,
    "candidateUrl" TEXT,
    "candidateAccessedAt" TIMESTAMP(3),
    "comparedApprovedVersionNumber" INTEGER NOT NULL,
    "disposition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_check_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "source_evidence_pin" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersionId" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "targetKind" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "rangeText" TEXT NOT NULL,
    "reviewedAgainstVersionNumber" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewKind" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_evidence_pin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "source_version_in_use_signal" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_version_in_use_signal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_check_sourceId_idx" ON "source_check"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "source_evidence_pin_relationId_key" ON "source_evidence_pin"("relationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_evidence_pin_sourceId_idx" ON "source_evidence_pin"("sourceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_evidence_pin_sourceVersionId_idx" ON "source_evidence_pin"("sourceVersionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "source_evidence_pin_targetKind_targetId_idx" ON "source_evidence_pin"("targetKind", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "source_version_in_use_signal_sourceId_key" ON "source_version_in_use_signal"("sourceId");

DO $$ BEGIN
    ALTER TABLE "source_check" ADD CONSTRAINT "source_check_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "source_evidence_pin" ADD CONSTRAINT "source_evidence_pin_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "source_evidence_pin" ADD CONSTRAINT "source_evidence_pin_sourceVersionId_fkey" FOREIGN KEY ("sourceVersionId") REFERENCES "source_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "source_version_in_use_signal" ADD CONSTRAINT "source_version_in_use_signal_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
