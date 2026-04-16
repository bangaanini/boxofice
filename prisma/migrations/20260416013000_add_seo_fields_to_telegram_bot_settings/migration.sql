ALTER TABLE "TelegramBotSettings"
ADD COLUMN "brandName" TEXT NOT NULL DEFAULT 'Layar BoxOffice',
ADD COLUMN "appShortName" TEXT NOT NULL DEFAULT 'Layar BoxOffice',
ADD COLUMN "seoTitle" TEXT NOT NULL DEFAULT 'Layar BoxOffice',
ADD COLUMN "seoDescription" TEXT NOT NULL DEFAULT 'Layar BoxOffice adalah Mini App Telegram untuk nonton film Box Office, cari judul favorit, buka akses VIP, dan jalankan affiliate langsung dari Telegram.',
ADD COLUMN "seoKeywords" TEXT;
