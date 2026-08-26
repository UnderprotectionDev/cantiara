-- CreateTable
CREATE TABLE "project_skeleton_selection" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "emptyHeadings" TEXT[] NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_skeleton_selection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_skeleton_selection_projectId_idx" ON "project_skeleton_selection"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_skeleton_selection_projectId_name_key" ON "project_skeleton_selection"("projectId", "name");

-- AddForeignKey
ALTER TABLE "project_skeleton_selection" ADD CONSTRAINT "project_skeleton_selection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- Existing non-Blank Projects created before this table: record the closed catalog.
INSERT INTO "project_skeleton_selection" ("id", "projectId", "name", "surface", "emptyHeadings", "sortOrder")
SELECT gen_random_uuid()::text, p.id, v.name, v.surface, v.empty_headings, v.sort_order
FROM "project" p
CROSS JOIN (
    VALUES
        ('Sitemap', 'Project Wall', ARRAY['Primary Navigation', 'Secondary Navigation', 'Utility', 'External']::text[], 0),
        ('Customer Journey', 'Project Wall', ARRAY['Awareness', 'Consideration', 'Onboarding', 'Core Use', 'Retention']::text[], 1),
        ('Persona', 'Document', ARRAY['Context', 'Goals', 'Behaviors', 'Pain Points', 'Constraints', 'Evidence', 'Open Questions']::text[], 2),
        ('Retrospective', 'Document', ARRAY['Period', 'What worked?', 'What did not?', 'What did we learn?', 'Decisions', 'Next changes', 'Related records']::text[], 3),
        ('Launch Plan', 'Document', ARRAY['Release', 'Audience', 'Scope', 'Readiness', 'Communication', 'Launch steps', 'Risks', 'Observation plan', 'Related records']::text[], 4)
) AS v(name, surface, empty_headings, sort_order)
WHERE p."starterConfiguration" <> 'Blank Project';
