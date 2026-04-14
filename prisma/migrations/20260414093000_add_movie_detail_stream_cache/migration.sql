ALTER TABLE "Movie"
ADD COLUMN "genre" TEXT,
ADD COLUMN "year" TEXT,
ADD COLUMN "duration" TEXT,
ADD COLUMN "releaseDate" TEXT,
ADD COLUMN "actors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "directors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "streams" TEXT,
ADD COLUMN "detailSyncedAt" TIMESTAMP(3);

CREATE TABLE "MovieStreamCache" (
    "id" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "resolvedFrom" TEXT,
    "originalUrl" TEXT,
    "iframe" TEXT,
    "m3u8" TEXT,
    "sources" JSONB NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MovieStreamCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MovieStreamCache_movieId_key" ON "MovieStreamCache"("movieId");
CREATE UNIQUE INDEX "MovieStreamCache_sourceUrl_key" ON "MovieStreamCache"("sourceUrl");
CREATE INDEX "MovieStreamCache_checkedAt_idx" ON "MovieStreamCache"("checkedAt");
CREATE INDEX "Movie_detailSyncedAt_idx" ON "Movie"("detailSyncedAt");

ALTER TABLE "MovieStreamCache" ADD CONSTRAINT "MovieStreamCache_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
