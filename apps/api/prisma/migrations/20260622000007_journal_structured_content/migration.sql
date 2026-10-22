-- AlterTable: change JournalEntry.content from TEXT to JSONB
-- Existing string entries are wrapped as {"thoughts": "<old content>"}

-- Step 1: Add a temporary JSONB column
ALTER TABLE "JournalEntry" ADD COLUMN "content_new" JSONB;

-- Step 2: Migrate existing data — wrap plain text in a JSON structure
UPDATE "JournalEntry"
SET "content_new" = jsonb_build_object('thoughts', "content");

-- Step 3: Drop old column and rename
ALTER TABLE "JournalEntry" DROP COLUMN "content";
ALTER TABLE "JournalEntry" RENAME COLUMN "content_new" TO "content";

-- Step 4: Set NOT NULL
ALTER TABLE "JournalEntry" ALTER COLUMN "content" SET NOT NULL;
