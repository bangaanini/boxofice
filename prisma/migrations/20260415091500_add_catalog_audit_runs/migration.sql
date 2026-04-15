CREATE TABLE IF NOT EXISTS "CatalogAuditRun" (
  "id" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'running',
  "autoHide" BOOLEAN NOT NULL DEFAULT true,
  "batchSize" INTEGER NOT NULL,
  "totalMovies" INTEGER NOT NULL DEFAULT 0,
  "processedMovies" INTEGER NOT NULL DEFAULT 0,
  "completedBatches" INTEGER NOT NULL DEFAULT 0,
  "checked" INTEGER NOT NULL DEFAULT 0,
  "playable" INTEGER NOT NULL DEFAULT 0,
  "broken" INTEGER NOT NULL DEFAULT 0,
  "hidden" INTEGER NOT NULL DEFAULT 0,
  "refreshed" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "messages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" JSONB NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CatalogAuditRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CatalogAuditRun_startedAt_idx"
  ON "CatalogAuditRun"("startedAt");

CREATE INDEX IF NOT EXISTS "CatalogAuditRun_status_startedAt_idx"
  ON "CatalogAuditRun"("status", "startedAt");
