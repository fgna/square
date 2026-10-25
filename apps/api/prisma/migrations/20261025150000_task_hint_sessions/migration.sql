-- Persist server-owned hint usage by authenticated member and attempt key.
CREATE TABLE "TaskHintSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "taskVersion" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "hintsUsed" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TaskHintSession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TaskHintSession_userId_idempotencyKey_key" ON "TaskHintSession"("userId", "idempotencyKey");
CREATE INDEX "TaskHintSession_userId_taskId_idx" ON "TaskHintSession"("userId", "taskId");
ALTER TABLE "TaskHintSession" ADD CONSTRAINT "TaskHintSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
