-- AlterTable
ALTER TABLE "record_action" ADD COLUMN "inputs" JSONB NOT NULL DEFAULT '[]';
