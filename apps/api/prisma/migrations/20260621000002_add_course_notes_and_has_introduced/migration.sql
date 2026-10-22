-- AlterTable: add hasIntroduced flag to User
ALTER TABLE "User" ADD COLUMN "hasIntroduced" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: CourseNote for private lesson notes
CREATE TABLE "CourseNote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseNote_userId_idx" ON "CourseNote"("userId");
CREATE UNIQUE INDEX "CourseNote_userId_lessonId_key" ON "CourseNote"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "CourseNote" ADD CONSTRAINT "CourseNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CourseNote" ADD CONSTRAINT "CourseNote_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mark existing users who have posted an INTRODUCTION as hasIntroduced
UPDATE "User" SET "hasIntroduced" = true
WHERE "id" IN (SELECT DISTINCT "authorId" FROM "Post" WHERE "type" = 'INTRODUCTION');
