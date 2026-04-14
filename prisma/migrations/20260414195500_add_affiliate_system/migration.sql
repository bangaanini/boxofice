CREATE TABLE "AffiliateProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "totalClicks" INTEGER NOT NULL DEFAULT 0,
    "totalSignups" INTEGER NOT NULL DEFAULT 0,
    "activeReferrals" INTEGER NOT NULL DEFAULT 0,
    "totalCommission" INTEGER NOT NULL DEFAULT 0,
    "availableBalance" INTEGER NOT NULL DEFAULT 0,
    "pendingBalance" INTEGER NOT NULL DEFAULT 0,
    "withdrawnBalance" INTEGER NOT NULL DEFAULT 0,
    "minimumWithdraw" INTEGER NOT NULL DEFAULT 50000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateReferral" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "commissionEarned" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateReferral_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliatePayoutRequest" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliatePayoutRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AffiliateActivity" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AffiliateProfile_userId_key" ON "AffiliateProfile"("userId");
CREATE UNIQUE INDEX "AffiliateProfile_referralCode_key" ON "AffiliateProfile"("referralCode");
CREATE INDEX "AffiliateProfile_createdAt_idx" ON "AffiliateProfile"("createdAt");

CREATE UNIQUE INDEX "AffiliateReferral_referredUserId_key" ON "AffiliateReferral"("referredUserId");
CREATE INDEX "AffiliateReferral_profileId_createdAt_idx" ON "AffiliateReferral"("profileId", "createdAt");
CREATE INDEX "AffiliateReferral_status_idx" ON "AffiliateReferral"("status");

CREATE INDEX "AffiliatePayoutRequest_profileId_createdAt_idx" ON "AffiliatePayoutRequest"("profileId", "createdAt");
CREATE INDEX "AffiliatePayoutRequest_status_idx" ON "AffiliatePayoutRequest"("status");

CREATE INDEX "AffiliateActivity_profileId_createdAt_idx" ON "AffiliateActivity"("profileId", "createdAt");
CREATE INDEX "AffiliateActivity_type_idx" ON "AffiliateActivity"("type");

ALTER TABLE "AffiliateProfile" ADD CONSTRAINT "AffiliateProfile_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateReferral" ADD CONSTRAINT "AffiliateReferral_referredUserId_fkey"
FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliatePayoutRequest" ADD CONSTRAINT "AffiliatePayoutRequest_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AffiliateActivity" ADD CONSTRAINT "AffiliateActivity_profileId_fkey"
FOREIGN KEY ("profileId") REFERENCES "AffiliateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
