CREATE TABLE "MovieSyncJob" (
  "id" TEXT NOT NULL,
  "runnerToken" TEXT NOT NULL,
  "target" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "fromPage" INTEGER NOT NULL DEFAULT 0,
  "toPage" INTEGER NOT NULL DEFAULT 0,
  "perPage" INTEGER NOT NULL DEFAULT 18,
  "homeBatchSize" INTEGER NOT NULL DEFAULT 9,
  "movieBatchSize" INTEGER NOT NULL DEFAULT 9,
  "currentPhase" TEXT NOT NULL DEFAULT 'home',
  "currentPage" INTEGER NOT NULL DEFAULT 0,
  "currentOffset" INTEGER NOT NULL DEFAULT 0,
  "processedHomeMovies" INTEGER NOT NULL DEFAULT 0,
  "totalHomeMovies" INTEGER,
  "processedTrendingMovies" INTEGER NOT NULL DEFAULT 0,
  "totalTrendingMovies" INTEGER,
  "fetched" INTEGER NOT NULL DEFAULT 0,
  "created" INTEGER NOT NULL DEFAULT 0,
  "updated" INTEGER NOT NULL DEFAULT 0,
  "unchanged" INTEGER NOT NULL DEFAULT 0,
  "skippedUnsupported" INTEGER NOT NULL DEFAULT 0,
  "upserted" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "messages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "summary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "errorMessage" TEXT,
  "leaseId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MovieSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MovieSyncJob_status_createdAt_idx"
  ON "MovieSyncJob"("status", "createdAt");

CREATE INDEX "MovieSyncJob_updatedAt_idx"
  ON "MovieSyncJob"("updatedAt");
