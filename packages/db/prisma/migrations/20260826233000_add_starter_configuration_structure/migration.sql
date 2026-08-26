-- AlterTable
ALTER TABLE "project" ADD COLUMN "firstOpenExplanationDismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "project_stage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_area_setting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "pinned" BOOLEAN NOT NULL,
    "pinOrder" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_area_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_view" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_view_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_status" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "semantic" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_work_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_stage_projectId_idx" ON "project_stage"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "project_area_setting_projectId_name_key" ON "project_area_setting"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_view_projectId_name_key" ON "project_work_view"("projectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_work_status_projectId_semantic_key" ON "project_work_status"("projectId", "semantic");

-- AddForeignKey
ALTER TABLE "project_stage" ADD CONSTRAINT "project_stage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_area_setting" ADD CONSTRAINT "project_area_setting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_view" ADD CONSTRAINT "project_work_view_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_status" ADD CONSTRAINT "project_work_status_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- Existing Projects created before this table: apply the stored Starter Configuration once.
INSERT INTO "project_work_status" ("id", "projectId", "semantic", "label", "sortOrder")
SELECT gen_random_uuid()::text, p.id, v.semantic, v.semantic, v.sort_order
FROM "project" p
CROSS JOIN (
    VALUES
        ('Not Started', 0),
        ('In Progress', 1),
        ('Blocked', 2),
        ('Closed', 3)
) AS v(semantic, sort_order);

INSERT INTO "project_area_setting" ("id", "projectId", "name", "enabled", "pinned", "pinOrder")
SELECT gen_random_uuid()::text, p.id, a.name,
    CASE
        WHEN p."starterConfiguration" IN ('Solo SaaS', 'Mobile Application') THEN true
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name IN ('Work', 'Documents', 'Decisions', 'Technical Diagrams', 'Tests', 'Releases', 'GitHub') THEN true
        WHEN a.name IN ('Work', 'Documents') THEN true
        ELSE false
    END,
    CASE
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Discovery' THEN true
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Decisions' THEN true
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Design' THEN true
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Tests' THEN true
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Releases' THEN true
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'GitHub' THEN true
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'Tests' THEN true
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'Releases' THEN true
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Discovery' THEN true
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Design' THEN true
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Tests' THEN true
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Releases' THEN true
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Production' THEN true
        ELSE false
    END,
    CASE
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Discovery' THEN 0
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Decisions' THEN 1
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Design' THEN 2
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Tests' THEN 3
        WHEN p."starterConfiguration" = 'Solo SaaS' AND a.name = 'Releases' THEN 4
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'GitHub' THEN 0
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'Tests' THEN 1
        WHEN p."starterConfiguration" = 'Open Source Library' AND a.name = 'Releases' THEN 2
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Discovery' THEN 0
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Design' THEN 1
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Tests' THEN 2
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Releases' THEN 3
        WHEN p."starterConfiguration" = 'Mobile Application' AND a.name = 'Production' THEN 4
        ELSE NULL
    END
FROM "project" p
CROSS JOIN (
    VALUES
        ('Work'),
        ('Documents'),
        ('Discovery'),
        ('Decisions'),
        ('Design'),
        ('Technical Diagrams'),
        ('Tests'),
        ('Releases'),
        ('Production'),
        ('GitHub')
) AS a(name);

INSERT INTO "project_work_view" ("id", "projectId", "name", "sortOrder")
SELECT gen_random_uuid()::text, p.id, v.name, v.sort_order
FROM "project" p
CROSS JOIN (
    VALUES
        ('Backlog', 0),
        ('Board', 1),
        ('Roadmap', 2)
) AS v(name, sort_order)
WHERE (p."starterConfiguration" = 'Blank Project' AND v.name IN ('Backlog', 'Board'))
   OR (p."starterConfiguration" <> 'Blank Project');

INSERT INTO "project_stage" ("id", "projectId", "name", "state", "sortOrder")
SELECT gen_random_uuid()::text, p.id, v.name, 'Not Planned', v.sort_order
FROM "project" p
CROSS JOIN (
    VALUES
        ('Discovery', 0),
        ('Design', 1),
        ('Build', 2),
        ('Validate', 3),
        ('Release', 4),
        ('Operate', 5)
) AS v(name, sort_order)
WHERE p."starterConfiguration" IN ('Solo SaaS', 'Mobile Application');

INSERT INTO "project_stage" ("id", "projectId", "name", "state", "sortOrder")
SELECT gen_random_uuid()::text, p.id, v.name, 'Not Planned', v.sort_order
FROM "project" p
CROSS JOIN (
    VALUES
        ('Scope', 0),
        ('Build', 1),
        ('Validate', 2),
        ('Release', 3),
        ('Maintain', 4)
) AS v(name, sort_order)
WHERE p."starterConfiguration" = 'Open Source Library';

