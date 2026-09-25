CREATE TABLE "DriverProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "vehicleType" TEXT NOT NULL,
  "capacityQuantity" REAL NOT NULL,
  "capacityUnit" TEXT NOT NULL,
  "serviceArea" TEXT NOT NULL,
  "serviceRadiusKm" REAL,
  "latitude" REAL,
  "longitude" REAL,
  "availability" TEXT NOT NULL DEFAULT 'OFFLINE',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DriverProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "DispatchAssignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "donationId" TEXT,
  "communityContributionId" TEXT,
  "communityDonationId" TEXT,
  "recipientProfileId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "assignedDriverId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "pickupStartedAt" DATETIME,
  "pickedUpAt" DATETIME,
  "transitStartedAt" DATETIME,
  "deliveredAt" DATETIME,
  "completedAt" DATETIME,
  "cancelledAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "DispatchAssignment_source_check" CHECK (("donationId" IS NOT NULL AND "communityContributionId" IS NULL) OR ("donationId" IS NULL AND "communityContributionId" IS NOT NULL)),
  CONSTRAINT "DispatchAssignment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DispatchAssignment_communityContributionId_fkey" FOREIGN KEY ("communityContributionId") REFERENCES "CommunityContribution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DispatchAssignment_communityDonationId_fkey" FOREIGN KEY ("communityDonationId") REFERENCES "CommunityDonation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DispatchAssignment_recipientProfileId_fkey" FOREIGN KEY ("recipientProfileId") REFERENCES "RecipientProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DispatchAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "DispatchAssignment_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DriverProfile_userId_key" ON "DriverProfile"("userId");
CREATE INDEX "DriverProfile_availability_serviceArea_idx" ON "DriverProfile"("availability", "serviceArea");
CREATE UNIQUE INDEX "DispatchAssignment_donationId_key" ON "DispatchAssignment"("donationId");
CREATE UNIQUE INDEX "DispatchAssignment_communityContributionId_key" ON "DispatchAssignment"("communityContributionId");
CREATE INDEX "DispatchAssignment_status_createdAt_idx" ON "DispatchAssignment"("status", "createdAt");
CREATE INDEX "DispatchAssignment_assignedDriverId_status_idx" ON "DispatchAssignment"("assignedDriverId", "status");
CREATE INDEX "DispatchAssignment_recipientProfileId_status_idx" ON "DispatchAssignment"("recipientProfileId", "status");
