-- Durable, member-scoped quiz attempts. Deleting an account deletes its attempts.
CREATE TABLE "TaskAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskVersion" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "hintsUsed" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskAttempt_userId_idempotencyKey_key"
    ON "TaskAttempt"("userId", "idempotencyKey");
CREATE INDEX "TaskAttempt_userId_taskId_createdAt_idx"
    ON "TaskAttempt"("userId", "taskId", "createdAt");
ALTER TABLE "TaskAttempt"
    ADD CONSTRAINT "TaskAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
