ALTER TABLE "AffiliateReferral"
  ADD COLUMN IF NOT EXISTS "botKind" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "partnerBotId" TEXT;

ALTER TABLE "VipPaymentOrder"
  ADD COLUMN IF NOT EXISTS "botKind" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "partnerBotId" TEXT;

CREATE INDEX IF NOT EXISTS "AffiliateReferral_partnerBotId_createdAt_idx"
  ON "AffiliateReferral"("partnerBotId", "createdAt");

CREATE INDEX IF NOT EXISTS "AffiliateReferral_botKind_createdAt_idx"
  ON "AffiliateReferral"("botKind", "createdAt");

CREATE INDEX IF NOT EXISTS "VipPaymentOrder_partnerBotId_createdAt_idx"
  ON "VipPaymentOrder"("partnerBotId", "createdAt");

CREATE INDEX IF NOT EXISTS "VipPaymentOrder_botKind_createdAt_idx"
  ON "VipPaymentOrder"("botKind", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'AffiliateReferral_partnerBotId_fkey'
  ) THEN
    ALTER TABLE "AffiliateReferral"
      ADD CONSTRAINT "AffiliateReferral_partnerBotId_fkey"
      FOREIGN KEY ("partnerBotId") REFERENCES "PartnerBot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VipPaymentOrder_partnerBotId_fkey'
  ) THEN
    ALTER TABLE "VipPaymentOrder"
      ADD CONSTRAINT "VipPaymentOrder_partnerBotId_fkey"
      FOREIGN KEY ("partnerBotId") REFERENCES "PartnerBot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
