-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "videoDownloadable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LessonAttachment" ADD COLUMN     "downloadable" BOOLEAN NOT NULL DEFAULT true;
