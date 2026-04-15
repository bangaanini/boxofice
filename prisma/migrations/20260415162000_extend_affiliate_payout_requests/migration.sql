ALTER TABLE "AffiliatePayoutRequest"
  ADD COLUMN IF NOT EXISTS "payoutMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientName" TEXT,
  ADD COLUMN IF NOT EXISTS "accountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

UPDATE "AffiliatePayoutRequest"
SET
  "payoutMethod" = COALESCE("payoutMethod", 'bank'),
  "payoutProvider" = COALESCE("payoutProvider", 'Manual'),
  "recipientName" = COALESCE("recipientName", 'Belum diisi'),
  "accountNumber" = COALESCE("accountNumber", 'Belum diisi')
WHERE
  "payoutMethod" IS NULL
  OR "payoutProvider" IS NULL
  OR "recipientName" IS NULL
  OR "accountNumber" IS NULL;

ALTER TABLE "AffiliatePayoutRequest"
  ALTER COLUMN "payoutMethod" SET NOT NULL,
  ALTER COLUMN "payoutProvider" SET NOT NULL,
  ALTER COLUMN "recipientName" SET NOT NULL,
  ALTER COLUMN "accountNumber" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "AffiliatePayoutRequest_processedAt_idx"
  ON "AffiliatePayoutRequest"("processedAt");
