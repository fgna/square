ALTER TABLE "PlatformSettings"
  ADD COLUMN "androidAppDownloadEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "androidAppDownloadUrl" TEXT;
