-- Optional daily journal reminder: switched on per instance, chosen per member.
ALTER TABLE "PlatformSettings" ADD COLUMN "journalReminders" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN "journalReminderTime" TEXT NOT NULL DEFAULT '16:30';
ALTER TABLE "User" ADD COLUMN "journalReminder" TEXT;
ALTER TABLE "User" ADD COLUMN "lastJournalReminderAt" TIMESTAMP(3);
