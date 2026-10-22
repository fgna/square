-- Repair for fresh installs (#16): restores the journal prompt tables of a
-- historic migration that is no longer shipped. Idempotent, so existing
-- installations skip it. Schema only, no seed rows: prompts come from the
-- content pack or the admin area.

-- CreateTable
CREATE TABLE IF NOT EXISTS "JournalPromptCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalPromptCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "JournalPrompt" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "JournalPromptCategory_name_key" ON "JournalPromptCategory"("name");
CREATE INDEX IF NOT EXISTS "JournalPrompt_categoryId_idx" ON "JournalPrompt"("categoryId");

-- AddForeignKey (only when missing)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'JournalPrompt_categoryId_fkey'
                   AND connamespace = current_schema()::regnamespace) THEN
        ALTER TABLE "JournalPrompt" ADD CONSTRAINT "JournalPrompt_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "JournalPromptCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
