-- Cover image of an event: an uploaded picture or a photo from an image library (with its credit).
ALTER TABLE "Event" ADD COLUMN "coverUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "coverCredit" JSONB;
