import { describe, it, expect, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EventProposalsService } from './event-proposals.service';
import { proposedDateProblems } from './proposal-dates';

describe('proposed dates with an end', () => {
  it('accepts a start or a start/end interval, refuses an end before the start', () => {
    expect(proposedDateProblems(['2026-11-05T18:00', '2026-11-06T18:00/2026-11-06T19:30'])).toEqual([]);
    expect(proposedDateProblems(['2026-11-05T18:00/2026-11-05T17:00'])).toEqual(['The end must be after the start: 2026-11-05T18:00/2026-11-05T17:00']);
    expect(proposedDateProblems(['next friday'])).toEqual(['Invalid date: next friday']);
    expect(proposedDateProblems(['2026-11-05T18:00', '2026-11-05T18:00'])).toContain('Each date may be proposed only once');
  });
});

describe('EventProposalsService.update', () => {
  const A = '2026-11-05T18:00/2026-11-05T19:30';
  const B = '2026-11-06T18:00/2026-11-06T19:30';
  const C = '2026-11-07T18:00/2026-11-07T19:30';

  function setup() {
    const tx = {
      proposalVote: { update: vi.fn() },
      eventProposal: { update: vi.fn(async ({ data }: any) => ({ id: 'p1', ...data })) },
    };
    const prisma: any = {
      eventProposal: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'p1',
          votes: [
            { id: 'v1', dateVotes: [A, B] },
            { id: 'v2', dateVotes: [A] },
          ],
        }),
      },
      $transaction: vi.fn(async (fn: any) => fn(tx)),
    };
    return { service: new EventProposalsService(prisma), tx };
  }

  it('changes the dates and drops only the votes for dates that are gone', async () => {
    const { service, tx } = setup();
    await service.update('p1', { title: 'Neu', proposedDates: [A, C] });
    expect(tx.proposalVote.update).toHaveBeenCalledTimes(1);
    expect(tx.proposalVote.update).toHaveBeenCalledWith({ where: { id: 'v1' }, data: { dateVotes: [A] } });
    expect(tx.eventProposal.update).toHaveBeenCalledWith(expect.objectContaining({ data: { title: 'Neu', proposedDates: [A, C] } }));
  });

  it('refuses an end before the start', async () => {
    const { service } = setup();
    await expect(service.update('p1', { proposedDates: [A, '2026-11-08T18:00/2026-11-08T08:00'] })).rejects.toBeInstanceOf(BadRequestException);
  });
});
