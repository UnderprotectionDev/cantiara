-- AlterTable
ALTER TABLE "focus_period" ADD COLUMN "startScopeTargetDates" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "focus_period" ADD COLUMN "leftoverDecisions" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "focus_period" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "focus_period" ADD COLUMN "evaluationKeep" TEXT NOT NULL DEFAULT '';
ALTER TABLE "focus_period" ADD COLUMN "evaluationChange" TEXT NOT NULL DEFAULT '';
ALTER TABLE "focus_period" ADD COLUMN "evaluationTryNext" TEXT NOT NULL DEFAULT '';
ALTER TABLE "focus_period" ADD COLUMN "evaluationSkipped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "focus_period" ADD COLUMN "followUpWorkIds" JSONB NOT NULL DEFAULT '[]';
