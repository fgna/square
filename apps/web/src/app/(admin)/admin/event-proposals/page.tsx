'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, Lock, Trash2, Users, Crown } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime } from '@community/shared';

type Filter = 'open' | 'closed' | 'all';

interface Proposal {
  id: string;
  title: string;
  description: string | null;
  proposedDates: string[];
  status: 'OPEN' | 'CLOSED';
  closedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; avatarUrl: string | null };
  _count: { votes: number };
  dateVoteCounts: Record<string, number>;
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
];

function useProposals() {
  return useQuery({
    queryKey: ['admin', 'event-proposals'],
    queryFn: () =>
      apiClient.get('/event-proposals', { params: { limit: 50 } }).then((r) => r.data),
  });
}

/** The proposed date with the most votes — what the admin turns into an event. */
function leadingDate(proposal: Proposal): { date: string; votes: number } | null {
  const entries = Object.entries(proposal.dateVoteCounts ?? {});
  if (entries.length === 0) return null;
  const [date, votes] = entries.reduce((best, current) =>
    current[1] > best[1] ? current : best,
  );
  return votes > 0 ? { date, votes } : null;
}

export default function AdminEventProposalsPage() {
  const [filter, setFilter] = useState<Filter>('open');
  const queryClient = useQueryClient();
  const { data, isLoading } = useProposals();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'event-proposals'] });
    queryClient.invalidateQueries({ queryKey: ['event-proposals'] });
  };

  const close = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/event-proposals/${id}/close`),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/event-proposals/${id}`),
    onSuccess: refresh,
  });

  const all: Proposal[] = data?.data ?? [];
  const proposals = all.filter((p) =>
    filter === 'all' ? true : filter === 'open' ? p.status === 'OPEN' : p.status === 'CLOSED',
  );
  const openCount = all.filter((p) => p.status === 'OPEN').length;
  const busy = close.isPending || remove.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Proposals"
        description="Dates the community is voting on"
        icon={CalendarClock}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {FILTERS.map((tab) => {
            const isActive = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setFilter(tab.value)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: isActive ? 'rgba(197,168,128,0.15)' : 'transparent',
                  color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                  border: `1px solid ${isActive ? 'rgba(197,168,128,0.25)' : 'var(--theme-border)'}`,
                }}
              >
                {tab.label}
                {tab.value === 'open' && openCount > 0 && ` (${openCount})`}
              </button>
            );
          })}
        </div>
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {proposals.length} shown
        </span>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))
        ) : proposals.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--theme-text-muted)' }}>
            <CalendarClock size={32} className="mx-auto mb-3 opacity-30" />
            <p>{filter === 'open' ? 'No proposals being voted on' : 'Nothing here'}</p>
            <p className="text-xs mt-2">
              New proposals are created from the Events page, where members vote on them.
            </p>
          </div>
        ) : (
          proposals.map((proposal) => {
            const leader = leadingDate(proposal);
            return (
              <div
                key={proposal.id}
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: 'var(--theme-card)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm" style={{ color: 'var(--theme-text)' }}>
                        {proposal.title}
                      </span>
                      {proposal.status === 'OPEN' ? (
                        <Badge className="bg-green-500/15 text-green-400 border-green-500/20 text-xs">
                          Open
                        </Badge>
                      ) : (
                        <Badge className="bg-white/10 text-white/60 border-white/20 text-xs">
                          Closed
                        </Badge>
                      )}
                      <span
                        className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--theme-text-muted)' }}
                      >
                        <Users size={11} />
                        {proposal._count?.votes ?? 0} voted
                      </span>
                    </div>
                    {proposal.description && (
                      <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                        {proposal.description}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                      by {proposal.createdBy?.name}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {proposal.status === 'OPEN' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => close.mutate(proposal.id)}
                      >
                        <Lock size={14} className="mr-1" />
                        Close voting
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete “${proposal.title}” and all its votes?`)) {
                          remove.mutate(proposal.id);
                        }
                      }}
                      style={{ color: 'var(--theme-danger, #ef4444)' }}
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </Button>
                  </div>
                </div>

                {/* Vote tally per proposed date */}
                <div className="space-y-1.5">
                  {(proposal.proposedDates ?? []).map((date) => {
                    const votes = proposal.dateVoteCounts?.[date] ?? 0;
                    const isLeader = leader?.date === date;
                    return (
                      <div
                        key={date}
                        className="flex items-center justify-between rounded-lg px-3 py-1.5 text-xs"
                        style={{
                          background: isLeader ? 'rgba(197,168,128,0.1)' : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${isLeader ? 'rgba(197,168,128,0.25)' : 'var(--theme-border)'}`,
                        }}
                      >
                        <span
                          className="flex items-center gap-1.5"
                          style={{ color: isLeader ? 'var(--theme-primary)' : 'var(--theme-text)' }}
                        >
                          {isLeader && <Crown size={11} />}
                          {formatDateTime(date)}
                        </span>
                        <span style={{ color: 'var(--theme-text-muted)' }}>
                          {votes} {votes === 1 ? 'vote' : 'votes'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {leader && (
                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                    Leading date: <strong>{formatDateTime(leader.date)}</strong> — create the event
                    under Admin → Events.
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
