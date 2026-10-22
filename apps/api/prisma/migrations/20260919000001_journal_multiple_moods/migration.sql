-- JournalEntry: Einzel-Mood -> Mehrfachauswahl
-- Bestehende Einträge behalten ihren Mood als einelementiges Array.

ALTER TABLE "JournalEntry" ADD COLUMN "moods" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "JournalEntry"
SET "moods" = ARRAY["mood"]
WHERE "mood" IS NOT NULL AND "mood" <> '';

ALTER TABLE "JournalEntry" DROP COLUMN "mood";
