-- CreateTable
CREATE TABLE "RecipientProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT NOT NULL,
    "serviceArea" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "serviceRadiusKm" REAL,
    "capacityQuantity" REAL,
    "capacityUnit" TEXT,
    "dietaryRestrictions" TEXT,
    "availabilityNotes" TEXT,
    "isAcceptingDonations" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "verificationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecipientProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipientFoodCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    CONSTRAINT "RecipientFoodCategory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "RecipientProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "RecipientProfile_userId_key" ON "RecipientProfile"("userId");
CREATE INDEX "RecipientProfile_verificationStatus_isActive_isAcceptingDonations_idx" ON "RecipientProfile"("verificationStatus", "isActive", "isAcceptingDonations");
CREATE INDEX "RecipientProfile_recipientType_serviceArea_idx" ON "RecipientProfile"("recipientType", "serviceArea");
CREATE UNIQUE INDEX "RecipientFoodCategory_profileId_category_key" ON "RecipientFoodCategory"("profileId", "category");
CREATE INDEX "RecipientFoodCategory_category_idx" ON "RecipientFoodCategory"("category");
