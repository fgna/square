-- CreateEnum
CREATE TYPE "EmailDigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'NONE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailDigest" "EmailDigestFrequency" NOT NULL DEFAULT 'WEEKLY';
ALTER TABLE "User" ADD COLUMN "lastDigestAt" TIMESTAMP(3);
