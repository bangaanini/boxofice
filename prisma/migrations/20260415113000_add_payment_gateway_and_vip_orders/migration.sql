CREATE TABLE IF NOT EXISTS "PaymentGatewaySettings" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL DEFAULT 'default',
  "provider" TEXT NOT NULL DEFAULT 'paymenku',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "checkoutButtonLabel" TEXT NOT NULL DEFAULT 'Aktifkan sekarang',
  "stripeSecretKey" TEXT,
  "stripePublishableKey" TEXT,
  "stripeWebhookSecret" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentGatewaySettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PaymentGatewaySettings_slug_key"
  ON "PaymentGatewaySettings"("slug");

CREATE TABLE IF NOT EXISTS "VipPlan" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "badge" TEXT,
  "durationDays" INTEGER NOT NULL,
  "priceAmount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "ctaLabel" TEXT NOT NULL DEFAULT 'Aktifkan sekarang',
  "highlight" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VipPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VipPlan_slug_key"
  ON "VipPlan"("slug");

CREATE INDEX IF NOT EXISTS "VipPlan_active_sortOrder_idx"
  ON "VipPlan"("active", "sortOrder");

CREATE TABLE IF NOT EXISTS "VipPaymentOrder" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'IDR',
  "checkoutUrl" TEXT,
  "externalCheckoutId" TEXT,
  "externalPaymentId" TEXT,
  "metadata" JSONB,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VipPaymentOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "VipPaymentOrder_externalCheckoutId_key"
  ON "VipPaymentOrder"("externalCheckoutId");

CREATE INDEX IF NOT EXISTS "VipPaymentOrder_userId_createdAt_idx"
  ON "VipPaymentOrder"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "VipPaymentOrder_status_createdAt_idx"
  ON "VipPaymentOrder"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "VipPaymentOrder_planId_createdAt_idx"
  ON "VipPaymentOrder"("planId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VipPaymentOrder_userId_fkey'
  ) THEN
    ALTER TABLE "VipPaymentOrder"
      ADD CONSTRAINT "VipPaymentOrder_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'VipPaymentOrder_planId_fkey'
  ) THEN
    ALTER TABLE "VipPaymentOrder"
      ADD CONSTRAINT "VipPaymentOrder_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "VipPlan"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
