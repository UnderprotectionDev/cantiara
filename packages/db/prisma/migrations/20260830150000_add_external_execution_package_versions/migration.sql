-- CreateTable
CREATE TABLE "external_execution_going_package" (
    "id" TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "markdown" TEXT NOT NULL,
    "producedAt" TIMESTAMP(3) NOT NULL,
    "selectedVersionManifest" JSONB NOT NULL,
    "permittedGithubContext" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_execution_going_package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_execution_handoff_event" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "handoffId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "packageVersion" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_execution_handoff_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_execution_going_package_handoffId_version_key" ON "external_execution_going_package"("handoffId", "version");

-- CreateIndex
CREATE INDEX "external_execution_going_package_handoffId_createdAt_idx" ON "external_execution_going_package"("handoffId", "createdAt");

-- CreateIndex
CREATE INDEX "external_execution_handoff_event_workId_occurredAt_idx" ON "external_execution_handoff_event"("workId", "occurredAt");

-- CreateIndex
CREATE INDEX "external_execution_handoff_event_handoffId_occurredAt_idx" ON "external_execution_handoff_event"("handoffId", "occurredAt");

-- AddForeignKey
ALTER TABLE "external_execution_going_package" ADD CONSTRAINT "external_execution_going_package_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "external_execution_handoff"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "external_execution_handoff_event" ADD CONSTRAINT "external_execution_handoff_event_workId_fkey" FOREIGN KEY ("workId") REFERENCES "work"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "external_execution_handoff_event" ADD CONSTRAINT "external_execution_handoff_event_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "external_execution_handoff"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- Backfill version 1 from the sent going package already stored on each handoff.
INSERT INTO "external_execution_going_package" (
    "id",
    "handoffId",
    "version",
    "markdown",
    "producedAt",
    "selectedVersionManifest",
    "permittedGithubContext",
    "createdAt",
    "updatedAt"
)
SELECT
    h."id" || ':1',
    h."id",
    1,
    h."goingPackageMarkdown",
    h."goingPackageProducedAt",
    h."selectedVersionManifest",
    h."permittedGithubContext",
    h."createdAt",
    h."updatedAt"
FROM "external_execution_handoff" h;

INSERT INTO "external_execution_handoff_event" (
    "id",
    "workId",
    "handoffId",
    "kind",
    "actorType",
    "actorId",
    "occurredAt",
    "packageVersion",
    "createdAt",
    "updatedAt"
)
SELECT
    h."id" || ':started',
    h."workId",
    h."id",
    'started',
    'User',
    COALESCE(
        (
            SELECT r."actorId"
            FROM "mutation_receipt" r
            WHERE r."targetId" = h."id"
            ORDER BY r."createdAt" ASC
            LIMIT 1
        ),
        'unknown'
    ),
    h."createdAt",
    NULL,
    h."createdAt",
    h."updatedAt"
FROM "external_execution_handoff" h;

INSERT INTO "external_execution_handoff_event" (
    "id",
    "workId",
    "handoffId",
    "kind",
    "actorType",
    "actorId",
    "occurredAt",
    "packageVersion",
    "createdAt",
    "updatedAt"
)
SELECT
    h."id" || ':package-exported:1',
    h."workId",
    h."id",
    'package-exported',
    'User',
    COALESCE(
        (
            SELECT r."actorId"
            FROM "mutation_receipt" r
            WHERE r."targetId" = h."id"
            ORDER BY r."createdAt" ASC
            LIMIT 1
        ),
        'unknown'
    ),
    h."goingPackageProducedAt",
    1,
    h."createdAt",
    h."updatedAt"
FROM "external_execution_handoff" h;
