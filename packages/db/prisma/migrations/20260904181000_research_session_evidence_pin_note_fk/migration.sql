-- AddForeignKey (idempotent)
DO $$
BEGIN
    ALTER TABLE "research_session_evidence_pin" ADD CONSTRAINT "research_session_evidence_pin_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "research_session_note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
