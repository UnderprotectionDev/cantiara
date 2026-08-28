-- This migration was initially applied to some databases by schema sync before
-- migrate deploy ran. Re-running it must converge that known-good shape and
-- still fail closed if the pre-existing relation has drifted.
DO $$
DECLARE
    missing_column text;
BEGIN
    IF to_regclass('public.tag_inline_use') IS NULL THEN
        CREATE TABLE "tag_inline_use" (
            "id" TEXT NOT NULL,
            "tagId" TEXT NOT NULL,
            "documentId" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "revision" INTEGER NOT NULL,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,

            CONSTRAINT "tag_inline_use_pkey" PRIMARY KEY ("id")
        );
    ELSE
        SELECT column_name INTO missing_column
        FROM (VALUES
            ('id'), ('tagId'), ('documentId'), ('body'),
            ('revision'), ('createdAt'), ('updatedAt')
        ) AS expected(column_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            AS c
            WHERE table_schema = 'public'
              AND table_name = 'tag_inline_use'
              AND c.column_name = expected.column_name
        )
        LIMIT 1;

        IF missing_column IS NOT NULL THEN
            RAISE EXCEPTION
                'Existing relation "tag_inline_use" is missing expected column "%"',
                missing_column;
        END IF;
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tag_inline_use_documentId_idx"
    ON "tag_inline_use"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "tag_inline_use_tagId_documentId_key"
    ON "tag_inline_use"("tagId", "documentId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'tag_inline_use_tagId_fkey'
          AND conrelid = 'public.tag_inline_use'::regclass
    ) THEN
        ALTER TABLE "tag_inline_use"
            ADD CONSTRAINT "tag_inline_use_tagId_fkey"
            FOREIGN KEY ("tagId") REFERENCES "tag"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
