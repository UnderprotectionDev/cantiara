-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "actorAlias" TEXT NOT NULL,
    "accountAlias" TEXT NOT NULL,
    "sessionAlias" TEXT,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_accountAlias_occurredAt_idx" ON "audit_event"("accountAlias", "occurredAt");
