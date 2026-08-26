-- CreateTable
CREATE TABLE "capture_extension_link" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "family" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capture_extension_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capture_pairing_code" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capture_pairing_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capture_extension_link_tokenHash_key" ON "capture_extension_link"("tokenHash");

-- CreateIndex
CREATE INDEX "capture_extension_link_workspaceId_ownerId_idx" ON "capture_extension_link"("workspaceId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "capture_pairing_code_codeHash_key" ON "capture_pairing_code"("codeHash");

-- CreateIndex
CREATE INDEX "capture_pairing_code_workspaceId_ownerId_idx" ON "capture_pairing_code"("workspaceId", "ownerId");
