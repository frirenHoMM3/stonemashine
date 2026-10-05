CREATE TABLE "Hit" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ref" TEXT,
    "device" TEXT NOT NULL,

    CONSTRAINT "Hit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Hit_createdAt_idx" ON "Hit"("createdAt");
CREATE INDEX "Hit_kind_createdAt_idx" ON "Hit"("kind", "createdAt");
CREATE INDEX "Hit_path_createdAt_idx" ON "Hit"("path", "createdAt");
