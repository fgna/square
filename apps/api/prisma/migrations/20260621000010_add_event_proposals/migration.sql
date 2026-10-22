CREATE TYPE "ProposalStatus" AS ENUM ('OPEN', 'CLOSED');

CREATE TABLE "EventProposal" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "proposedDates" JSONB NOT NULL DEFAULT '[]',
    "status" "ProposalStatus" NOT NULL DEFAULT 'OPEN',
    "createdById" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventProposal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalVote" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateVotes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProposalVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProposalVote_proposalId_userId_key" ON "ProposalVote"("proposalId", "userId");
CREATE INDEX "EventProposal_status_idx" ON "EventProposal"("status");
ALTER TABLE "EventProposal" ADD CONSTRAINT "EventProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "EventProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProposalVote" ADD CONSTRAINT "ProposalVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
