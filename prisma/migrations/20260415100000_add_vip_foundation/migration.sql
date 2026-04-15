ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "vipStartedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "vipExpiresAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "VipProgramSettings" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL DEFAULT 'default',
  "previewEnabled" BOOLEAN NOT NULL DEFAULT true,
  "previewLimitMinutes" INTEGER NOT NULL DEFAULT 3,
  "joinVipLabel" TEXT NOT NULL DEFAULT 'Buka VIP',
  "joinVipUrl" TEXT NOT NULL,
  "paywallTitle" TEXT NOT NULL DEFAULT 'Lanjutkan dengan VIP',
  "paywallDescription" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VipProgramSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VipProgramSettings_slug_key"
  ON "VipProgramSettings"("slug");
