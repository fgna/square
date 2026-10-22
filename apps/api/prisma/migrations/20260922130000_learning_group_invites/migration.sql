-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'GROUP_INVITE';

-- CreateTable
CREATE TABLE "LearningGroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningGroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningGroupInvite_groupId_userId_key" ON "LearningGroupInvite"("groupId", "userId");

-- CreateIndex
CREATE INDEX "LearningGroupInvite_userId_idx" ON "LearningGroupInvite"("userId");

-- AddForeignKey
ALTER TABLE "LearningGroupInvite" ADD CONSTRAINT "LearningGroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LearningGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGroupInvite" ADD CONSTRAINT "LearningGroupInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGroupInvite" ADD CONSTRAINT "LearningGroupInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
