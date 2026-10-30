-- Admins highlight selected events (e.g. weekly live sessions) so they stand out among recurring series.
ALTER TABLE "Event" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
