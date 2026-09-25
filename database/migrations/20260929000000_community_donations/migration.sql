CREATE TABLE "CommunityDonation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "creatorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "pickupArea" TEXT NOT NULL,
  "latitude" REAL,
  "longitude" REAL,
  "targetQuantity" REAL,
  "targetCategory" TEXT,
  "targetUnit" TEXT,
  "deadline" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityDonation_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "CommunityContribution" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "communityDonationId" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "foodName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "quantity" REAL NOT NULL,
  "unit" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "belowIndividualThreshold" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "CommunityContribution_communityDonationId_fkey" FOREIGN KEY ("communityDonationId") REFERENCES "CommunityDonation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CommunityContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "IndividualContributionThreshold" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL,
  "minimumQuantity" REAL NOT NULL,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "IndividualContributionThreshold_category_unit_key" ON "IndividualContributionThreshold"("category", "unit");
CREATE INDEX "CommunityDonation_status_pickupArea_deadline_idx" ON "CommunityDonation"("status", "pickupArea", "deadline");
CREATE INDEX "CommunityDonation_creatorId_status_createdAt_idx" ON "CommunityDonation"("creatorId", "status", "createdAt");
CREATE INDEX "CommunityDonation_deadline_status_idx" ON "CommunityDonation"("deadline", "status");
CREATE INDEX "CommunityContribution_communityDonationId_status_createdAt_idx" ON "CommunityContribution"("communityDonationId", "status", "createdAt");
CREATE INDEX "CommunityContribution_contributorId_status_createdAt_idx" ON "CommunityContribution"("contributorId", "status", "createdAt");
CREATE INDEX "CommunityContribution_category_unit_status_idx" ON "CommunityContribution"("category", "unit", "status");
