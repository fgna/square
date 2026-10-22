import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';

@Injectable()
export class EventProposalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20, userId?: string) {
    limit = Math.max(1, Math.min(limit, 50));
    page = Math.max(1, page);
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.eventProposal.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          createdBy: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { votes: true } },
          // Every vote's date picks are needed for the per-date tally. Only the
          // aggregate is returned — never who voted for what (SEC-038).
          votes: { select: { userId: true, dateVotes: true } },
        },
      }),
      this.prisma.eventProposal.count(),
    ]);

    const enriched = data.map((p) => {
      const allVotes = (p as any).votes || [];
      const myVote = userId ? allVotes.find((v: any) => v.userId === userId) : null;

      const dateVoteCounts: Record<string, number> = {};
      const proposedDates = (p.proposedDates as string[]) || [];
      proposedDates.forEach((d) => { dateVoteCounts[d] = 0; });
      allVotes.forEach((v: any) => {
        ((v.dateVotes as string[]) || []).forEach((d) => {
          if (dateVoteCounts[d] !== undefined) dateVoteCounts[d]++;
        });
      });

      return {
        ...p,
        hasVoted: !!myVote,
        myDateVotes: myVote?.dateVotes || [],
        dateVoteCounts,
        votes: undefined,
      };
    });

    return { data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, userId?: string, isAdmin = false) {
    const proposal = await this.prisma.eventProposal.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
        votes: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!proposal) throw new NotFoundException('Proposal not found');

    const dateVoteCounts: Record<string, number> = {};
    const proposedDates = (proposal.proposedDates as string[]) || [];
    proposedDates.forEach((d) => { dateVoteCounts[d] = 0; });

    proposal.votes.forEach((v) => {
      const dv = (v.dateVotes as string[]) || [];
      dv.forEach((d) => {
        if (dateVoteCounts[d] !== undefined) dateVoteCounts[d]++;
      });
    });

    const myVote = userId ? proposal.votes.find((v) => v.userId === userId) : null;

    // SEC-038: Strip individual voter details for non-admin users
    // Only return aggregate vote counts, not who voted for what
    const { votes, ...proposalWithoutVotes } = proposal;

    return {
      ...proposalWithoutVotes,
      voteCount: votes.length,
      dateVoteCounts,
      hasVoted: !!myVote,
      myDateVotes: myVote ? (myVote.dateVotes as string[]) : [],
      ...(isAdmin ? { votes } : {}),
    };
  }

  async create(userId: string, dto: CreateProposalDto) {
    return this.prisma.eventProposal.create({
      data: {
        title: dto.title,
        description: dto.description,
        proposedDates: dto.proposedDates,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async vote(proposalId: string, userId: string, dateVotes: string[] = []) {
    // SEC-039: Wrap in transaction to prevent TOCTOU race on proposal status
    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.eventProposal.findUnique({
        where: { id: proposalId },
      });

      if (!proposal) throw new NotFoundException('Proposal not found');
      if (proposal.status === 'CLOSED') throw new BadRequestException('Proposal is closed');

      // SEC-039: Validate that submitted dates exist in the proposal's proposedDates
      const proposedDates = (proposal.proposedDates as string[]) || [];
      const invalidDates = dateVotes.filter((d) => !proposedDates.includes(d));
      if (invalidDates.length > 0) {
        throw new BadRequestException(
          `Invalid dates: ${invalidDates.join(', ')}. Must be one of: ${proposedDates.join(', ')}`,
        );
      }

      return tx.proposalVote.upsert({
        where: {
          proposalId_userId: { proposalId, userId },
        },
        create: {
          proposalId,
          userId,
          dateVotes,
        },
        update: {
          dateVotes,
        },
      });
    });
  }

  async removeVote(proposalId: string, userId: string) {
    try {
      await this.prisma.proposalVote.delete({
        where: {
          proposalId_userId: { proposalId, userId },
        },
      });
    } catch {
      throw new NotFoundException('Vote not found');
    }
    return { message: 'Vote removed' };
  }

  async close(id: string) {
    const proposal = await this.prisma.eventProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    return this.prisma.eventProposal.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async delete(id: string) {
    const proposal = await this.prisma.eventProposal.findUnique({ where: { id } });
    if (!proposal) throw new NotFoundException('Proposal not found');

    await this.prisma.eventProposal.delete({ where: { id } });
    return { message: 'Proposal deleted' };
  }
}
