-- Defensive Filmbox migration. DB may still carry remnants from a previous
-- streamapi migration (inTrending, inIndonesian, etc.). We normalize the
-- Movie table to the Filmbox schema regardless of starting state.

-- Drop legacy LK21 feed flags (if present)
ALTER TABLE "Movie"
  DROP COLUMN IF EXISTS "inHome",
  DROP COLUMN IF EXISTS "inPopular",
  DROP COLUMN IF EXISTS "inNew";

-- Drop streamapi flags (if leftover)
ALTER TABLE "Movie"
  DROP COLUMN IF EXISTS "inTrending",
  DROP COLUMN IF EXISTS "inIndonesian",
  DROP COLUMN IF EXISTS "inAdultComedy",
  DROP COLUMN IF EXISTS "inWesternTv",
  DROP COLUMN IF EXISTS "subtitles",
  DROP COLUMN IF EXISTS "streamPlayerUrl",
  DROP COLUMN IF EXISTS "contentType",
  DROP COLUMN IF EXISTS "totalSeasons",
  DROP COLUMN IF EXISTS "streams";

-- Add Filmbox columns
ALTER TABLE "Movie"
  ADD COLUMN IF NOT EXISTS "detailPath"            TEXT,
  ADD COLUMN IF NOT EXISTS "subjectId"             TEXT,
  ADD COLUMN IF NOT EXISTS "subjectType"           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "country"               TEXT,
  ADD COLUMN IF NOT EXISTS "bahasa"                TEXT,
  ADD COLUMN IF NOT EXISTS "hasIndonesianSubtitle" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "totalEpisode"          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "totalSeason"           INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "seasonsList"           JSONB,
  ADD COLUMN IF NOT EXISTS "trailerUrl"            TEXT,
  ADD COLUMN IF NOT EXISTS "inHero"                BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "homeSections"          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Add `streams` legacy column back as nullable text (Movie schema still references it for safety
-- in the Prisma model). It is kept nullable; existing data preserved if any.
ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "streams" TEXT;

-- Drop legacy indexes (idempotent)
DROP INDEX IF EXISTS "Movie_inHome_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inPopular_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inNew_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inTrending_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inIndonesian_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inAdultComedy_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_inWesternTv_updatedAt_idx";
DROP INDEX IF EXISTS "Movie_hasIndonesianSubtitle_idx";

-- Drop obsolete tables (Filmbox returns playable URLs directly + audit retired)
DROP TABLE IF EXISTS "MovieStreamCache" CASCADE;
DROP TABLE IF EXISTS "CatalogAuditRun" CASCADE;

-- Recreate uniqueness + indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Movie_subjectId_key" ON "Movie"("subjectId");
CREATE INDEX IF NOT EXISTS "Movie_inHero_updatedAt_idx" ON "Movie"("inHero", "updatedAt");
CREATE INDEX IF NOT EXISTS "Movie_subjectType_updatedAt_idx" ON "Movie"("subjectType", "updatedAt");
CREATE INDEX IF NOT EXISTS "Movie_homeSections_idx" ON "Movie" USING GIN ("homeSections");
