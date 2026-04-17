CREATE TABLE "ChannelBroadcast" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "movieId" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "partnerBotId" TEXT,
    "botKind" TEXT NOT NULL DEFAULT 'default',
    "botUsername" TEXT NOT NULL,
    "channelUsername" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "telegramMessageId" INTEGER,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelBroadcast_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChannelBroadcast_token_key" ON "ChannelBroadcast"("token");
CREATE INDEX "ChannelBroadcast_movieId_createdAt_idx" ON "ChannelBroadcast"("movieId", "createdAt");
CREATE INDEX "ChannelBroadcast_ownerUserId_createdAt_idx" ON "ChannelBroadcast"("ownerUserId", "createdAt");
CREATE INDEX "ChannelBroadcast_partnerBotId_createdAt_idx" ON "ChannelBroadcast"("partnerBotId", "createdAt");
CREATE INDEX "ChannelBroadcast_botKind_createdAt_idx" ON "ChannelBroadcast"("botKind", "createdAt");

ALTER TABLE "ChannelBroadcast" ADD CONSTRAINT "ChannelBroadcast_movieId_fkey" FOREIGN KEY ("movieId") REFERENCES "Movie"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChannelBroadcast" ADD CONSTRAINT "ChannelBroadcast_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ChannelBroadcast" ADD CONSTRAINT "ChannelBroadcast_partnerBotId_fkey" FOREIGN KEY ("partnerBotId") REFERENCES "PartnerBot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
