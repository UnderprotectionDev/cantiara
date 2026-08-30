-- AlterTable
ALTER TABLE "external_execution_handoff" ADD COLUMN "returnRecord" JSONB;
ALTER TABLE "external_execution_handoff" ADD COLUMN "reconcileDecision" JSONB;
