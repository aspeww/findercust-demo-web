-- CreateTable
CREATE TABLE "Search" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Türkiye',
    "city" TEXT NOT NULL,
    "district" TEXT,
    "radiusKm" INTEGER NOT NULL DEFAULT 10,
    "sector" TEXT NOT NULL,
    "segment" TEXT,
    "status" TEXT NOT NULL DEFAULT 'partial',
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "resultsJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Search_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Search_ownerId_idx" ON "Search"("ownerId");

-- CreateIndex
CREATE INDEX "Search_createdAt_idx" ON "Search"("createdAt");
