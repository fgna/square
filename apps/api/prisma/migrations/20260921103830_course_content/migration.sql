-- CreateEnum
CREATE TYPE "CourseReleaseMode" AS ENUM ('ALL_AT_ONCE', 'DRIP');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "releaseMode" "CourseReleaseMode" NOT NULL DEFAULT 'ALL_AT_ONCE';

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "releaseAfterDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "content" SET DEFAULT '';

-- CreateTable
CREATE TABLE "LessonAttachment" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonAttachment_lessonId_idx" ON "LessonAttachment"("lessonId");

-- AddForeignKey
ALTER TABLE "LessonAttachment" ADD CONSTRAINT "LessonAttachment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
