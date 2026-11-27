-- Announcements notify members (#143). Additive only.
ALTER TYPE "NotificationType" ADD VALUE 'ANNOUNCEMENT';

ALTER TABLE "User" ADD COLUMN "announcementEmails" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Post" ADD COLUMN "announcedAt" TIMESTAMP(3);

-- Announcements that are already published count as announced, so the update
-- does not send old ones. Scheduled ones still notify when they are published.
UPDATE "Post" SET "announcedAt" = "createdAt" WHERE "type" = 'ANNOUNCEMENT' AND "publishAt" IS NULL;
