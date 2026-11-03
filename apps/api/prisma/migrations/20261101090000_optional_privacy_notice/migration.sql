-- Existing communities retain the previously enabled privacy notice.
-- New Square instances default to hiding the optional informational banner.
ALTER TABLE "PlatformSettings" ADD COLUMN "privacyNoticeEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "PlatformSettings" SET "privacyNoticeEnabled" = true;
