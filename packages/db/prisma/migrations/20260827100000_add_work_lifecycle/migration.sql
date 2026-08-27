-- CreateTable
CREATE TABLE "work" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_work_key_counter" (
    "projectId" TEXT NOT NULL,
    "nextNumber" INTEGER NOT NULL,

    CONSTRAINT "project_work_key_counter_pkey" PRIMARY KEY ("projectId")
);

-- CreateIndex
CREATE INDEX "work_projectId_idx" ON "work"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "work_projectId_number_key" ON "work"("projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "work_projectId_key_key" ON "work"("projectId", "key");

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "project_work_key_counter" ADD CONSTRAINT "project_work_key_counter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON UPDATE CASCADE ON DELETE CASCADE;
