CREATE TABLE "LearningGroup" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LearningGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningGroupMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningGroupMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningGroupMessage" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "groupId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningGroupMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningGroupMember_groupId_userId_key" ON "LearningGroupMember"("groupId", "userId");
CREATE INDEX "LearningGroupMember_userId_idx" ON "LearningGroupMember"("userId");
CREATE INDEX "LearningGroupMessage_groupId_createdAt_idx" ON "LearningGroupMessage"("groupId", "createdAt" DESC);

ALTER TABLE "LearningGroup" ADD CONSTRAINT "LearningGroup_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGroupMember" ADD CONSTRAINT "LearningGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LearningGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGroupMember" ADD CONSTRAINT "LearningGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGroupMessage" ADD CONSTRAINT "LearningGroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "LearningGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningGroupMessage" ADD CONSTRAINT "LearningGroupMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
