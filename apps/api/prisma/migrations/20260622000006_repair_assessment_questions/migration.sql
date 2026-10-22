-- Repair for fresh installs (#16): restores the assessment question table of a
-- historic migration that is no longer shipped. Idempotent, so existing
-- installations skip it. Schema only, no seed rows: questions come from the
-- content pack.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AssessmentQuestion" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentQuestion_questionId_key" ON "AssessmentQuestion"("questionId");
CREATE INDEX IF NOT EXISTS "AssessmentQuestion_dimension_idx" ON "AssessmentQuestion"("dimension");
