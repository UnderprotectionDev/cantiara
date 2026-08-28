-- CreateTable
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

-- CreateIndex
CREATE INDEX "tag_inline_use_documentId_idx" ON "tag_inline_use"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "tag_inline_use_tagId_documentId_key" ON "tag_inline_use"("tagId", "documentId");

-- AddForeignKey
ALTER TABLE "tag_inline_use" ADD CONSTRAINT "tag_inline_use_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
