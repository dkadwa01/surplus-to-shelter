-- AlterTable
ALTER TABLE "User" ADD COLUMN "donorType" TEXT;

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "donorId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "preparedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "pickupArea" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Donation_donorId_status_createdAt_idx" ON "Donation"("donorId", "status", "createdAt");
CREATE INDEX "Donation_status_category_expiresAt_idx" ON "Donation"("status", "category", "expiresAt");
CREATE INDEX "Donation_expiresAt_idx" ON "Donation"("expiresAt");
