-- Per event: whether members get the reminder 24 hours ahead (the 1-hour reminder stays).
ALTER TABLE "Event" ADD COLUMN "remind24h" BOOLEAN NOT NULL DEFAULT true;
