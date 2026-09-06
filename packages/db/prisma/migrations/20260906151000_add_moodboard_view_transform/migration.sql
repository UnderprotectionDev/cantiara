-- View-local crop, rotation, and Presentation Mode focus order on Moodboard.
ALTER TABLE "moodboard" ADD COLUMN IF NOT EXISTS "focusOrder" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "moodboard_visual" ADD COLUMN IF NOT EXISTS "crop" JSONB;
ALTER TABLE "moodboard_visual" ADD COLUMN IF NOT EXISTS "rotation" INTEGER NOT NULL DEFAULT 0;
