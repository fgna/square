-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "welcomeVideoUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "welcomeVideoDismissedAt" TIMESTAMP(3);
