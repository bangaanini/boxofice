ALTER TABLE "AffiliateProfile"
ADD COLUMN IF NOT EXISTS "commissionRate" INTEGER NOT NULL DEFAULT 25;

CREATE TABLE IF NOT EXISTS "AffiliateProgramSettings" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'default',
    "defaultCommissionRate" INTEGER NOT NULL DEFAULT 25,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateProgramSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AffiliateProgramSettings_slug_key"
ON "AffiliateProgramSettings"("slug");

INSERT INTO "AffiliateProgramSettings" (
    "id",
    "slug",
    "defaultCommissionRate",
    "createdAt",
    "updatedAt"
)
VALUES (
    'affiliate-settings-default',
    'default',
    25,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
