-- Work may already have this column when the schema advanced before its migration history.
ALTER TABLE "work" ADD COLUMN IF NOT EXISTS "reappear_date" date;
