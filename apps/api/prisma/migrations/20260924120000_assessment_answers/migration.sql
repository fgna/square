-- Keep every answer of a self-assessment, not only the dimension averages,
-- so a member can see what they answered and the canon can be evaluated per
-- anchor. N/A is stored as a NULL score.

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN "instrumentVersion" TEXT;
ALTER TABLE "Assessment" ALTER COLUMN "overallScore" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AssessmentAnswer" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "score" INTEGER,

    CONSTRAINT "AssessmentAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAnswer_assessmentId_questionId_key" ON "AssessmentAnswer"("assessmentId", "questionId");

-- AddForeignKey
ALTER TABLE "AssessmentAnswer" ADD CONSTRAINT "AssessmentAnswer_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
