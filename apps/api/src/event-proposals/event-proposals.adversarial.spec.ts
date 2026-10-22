/**
 * ADVERSARIAL TESTS: Event Proposals
 *
 * SEC-037: No ArrayMaxSize on proposedDates — unbounded array in DB
 * SEC-038: findOne() exposes all voters' names and their date choices (privacy leak)
 * SEC-039: vote() has TOCTOU race on proposal status (status check → upsert not transactional)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { EventProposalsService } from './event-proposals.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

function buildMockPrisma() {
  return {
    eventProposal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    proposalVote: {
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  };
}

async function buildService(prisma: ReturnType<typeof buildMockPrisma>) {
  const module = await Test.createTestingModule({
    providers: [
      EventProposalsService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get<EventProposalsService>(EventProposalsService);
}

describe('[SEC-037] unbounded proposedDates array', () => {
  it('CreateProposalDto rejects arrays exceeding max size', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      title: 'Flood Test',
      proposedDates: Array.from({ length: 10000 }, (_, i) => `2026-0${(i % 9) + 1}-01`),
    });

    const errors = await validate(dto);

    // SEC-037 FIX: ArrayMaxSize(20) now rejects unbounded arrays
    expect(errors.filter((e) => e.property === 'proposedDates')).toHaveLength(1);
  });

  it('CreateProposalDto accepts arrays within the limit', async () => {
    const dto = plainToInstance(CreateProposalDto, {
      title: 'Valid Proposal',
      proposedDates: Array.from({ length: 20 }, (_, i) => `2026-0${(i % 9) + 1}-01`),
    });

    const errors = await validate(dto);

    expect(errors.filter((e) => e.property === 'proposedDates')).toHaveLength(0);
  });
});

describe('[SEC-038] voter privacy leak in findOne()', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: EventProposalsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
  });

  it('findOne() does not expose individual voter details to non-admin users', async () => {
    prisma.eventProposal.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Team Offsite',
      proposedDates: ['2026-07-01', '2026-07-15'],
      status: 'OPEN',
      createdBy: { id: 'admin-1', name: 'Admin', avatarUrl: null },
      votes: [
        {
          userId: 'u1',
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
          dateVotes: ['2026-07-01'],
        },
        {
          userId: 'u2',
          user: { id: 'u2', name: 'Bob', avatarUrl: null },
          dateVotes: ['2026-07-15'],
        },
      ],
    });

    // SEC-038 FIX: Non-admin user only gets aggregate counts, not voter details
    const result = await service.findOne('p1', 'u1');

    expect(result.voteCount).toBe(2);
    expect(result.dateVoteCounts).toEqual({ '2026-07-01': 1, '2026-07-15': 1 });
    // Individual voter details are not exposed
    expect((result as any).votes).toBeUndefined();
  });

  it('non-admin user cannot see who voted for what', async () => {
    prisma.eventProposal.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Team Offsite',
      proposedDates: ['2026-07-01'],
      status: 'OPEN',
      createdBy: { id: 'admin-1', name: 'Admin', avatarUrl: null },
      votes: [
        {
          userId: 'u1',
          user: { id: 'u1', name: 'Secret Voter', avatarUrl: null },
          dateVotes: ['2026-07-01'],
        },
      ],
    });

    // SEC-038 FIX: A non-admin user does not get voter identities
    const result = await service.findOne('p1', 'u99');
    expect(result.hasVoted).toBe(false);
    expect((result as any).votes).toBeUndefined();
    expect(result.voteCount).toBe(1);
  });

  it('admin user can see individual voter details', async () => {
    prisma.eventProposal.findUnique.mockResolvedValue({
      id: 'p1',
      title: 'Team Offsite',
      proposedDates: ['2026-07-01'],
      status: 'OPEN',
      createdBy: { id: 'admin-1', name: 'Admin', avatarUrl: null },
      votes: [
        {
          userId: 'u1',
          user: { id: 'u1', name: 'Alice', avatarUrl: null },
          dateVotes: ['2026-07-01'],
        },
      ],
    });

    // SEC-038 FIX: Admin users get the full votes array
    const result = await service.findOne('p1', 'admin-1', true);
    expect(result.votes).toHaveLength(1);
    expect(result.votes![0].user.name).toBe('Alice');
  });
});

describe('[SEC-039] vote TOCTOU on proposal status', () => {
  let prisma: ReturnType<typeof buildMockPrisma>;
  let service: EventProposalsService;

  beforeEach(async () => {
    prisma = buildMockPrisma();
    service = await buildService(prisma);
  });

  it('vote() uses a transaction around status check + upsert', async () => {
    // SEC-039 FIX: $transaction is now used to wrap status check and upsert
    const mockTx = {
      eventProposal: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          status: 'OPEN',
          proposedDates: ['2026-07-01'],
        }),
      },
      proposalVote: {
        upsert: vi.fn().mockResolvedValue({
          proposalId: 'p1',
          userId: 'u1',
          dateVotes: ['2026-07-01'],
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

    await service.vote('p1', 'u1', ['2026-07-01']);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(mockTx.eventProposal.findUnique).toHaveBeenCalled();
    expect(mockTx.proposalVote.upsert).toHaveBeenCalled();
  });

  it('dateVotes referencing dates not in proposedDates are rejected', async () => {
    const mockTx = {
      eventProposal: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          status: 'OPEN',
          proposedDates: ['2026-07-01', '2026-07-15'],
        }),
      },
      proposalVote: {
        upsert: vi.fn(),
      },
    };
    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

    // SEC-039 FIX: vote rejects dates not in proposedDates
    await expect(
      service.vote('p1', 'u1', ['2099-01-01']),
    ).rejects.toThrow('Invalid dates');
    expect(mockTx.proposalVote.upsert).not.toHaveBeenCalled();
  });
});
