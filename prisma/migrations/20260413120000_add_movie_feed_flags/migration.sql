ALTER TABLE "Movie"
ADD COLUMN "inHome" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inPopular" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "inNew" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Movie_inHome_updatedAt_idx" ON "Movie"("inHome", "updatedAt");
CREATE INDEX "Movie_inPopular_updatedAt_idx" ON "Movie"("inPopular", "updatedAt");
CREATE INDEX "Movie_inNew_updatedAt_idx" ON "Movie"("inNew", "updatedAt");
