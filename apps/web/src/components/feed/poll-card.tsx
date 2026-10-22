'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CheckCircle2, Clock, BarChart3 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useFormatters } from '@/lib/use-formatters';
import { useAuth } from '@/hooks/use-auth';
import type { Poll } from '@community/shared';

interface PollCardProps {
  poll: Poll;
  postId: string;
}

export function PollCard({ poll, postId }: PollCardProps) {
  const t = useTranslations('feed');
  const { formatDate } = useFormatters();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const userVotedOptionId = poll.votes?.[0]?.optionId ?? poll.options.find((o) => o.votes?.length)?.id;
  const [optimisticVote, setOptimisticVote] = useState<string | null>(userVotedOptionId ?? null);

  const hasEnded = poll.endsAt ? new Date(poll.endsAt) < new Date() : false;
  const totalVotes = poll.options.reduce((sum, o) => sum + o._count.votes, 0);

  // Whether a click votes or retracts is decided at click time and passed in.
  // Reading `optimisticVote` inside mutationFn is not safe: onMutate has
  // already flipped it by then, so every first vote went out as a retraction.
  const vote = useMutation({
    mutationFn: async ({ optionId, retract }: { optionId: string; retract: boolean }) => {
      if (retract) {
        await apiClient.delete(`/posts/${postId}/poll/vote`);
        return null;
      }
      const { data } = await apiClient.post(`/posts/${postId}/poll/vote`, { optionId });
      return data;
    },
    onMutate: ({ optionId, retract }) => {
      const previous = optimisticVote;
      setOptimisticVote(retract ? null : optionId);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      setOptimisticVote(context?.previous ?? null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
  });

  const pct = (count: number) =>
    totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);

  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--theme-border)' }}
    >
      <div className="flex items-start gap-2">
        <BarChart3 size={15} style={{ color: 'var(--theme-primary)', flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
          {poll.question}
        </p>
      </div>

      <div className="space-y-2">
        {poll.options.map((option) => {
          const isVoted = optimisticVote === option.id;
          const percentage = pct(option._count.votes);
          const canVote = !!user && !hasEnded;

          return (
            <button
              key={option.id}
              disabled={!canVote || vote.isPending}
              onClick={() => canVote && vote.mutate({ optionId: option.id, retract: isVoted })}
              className="w-full text-left rounded-md overflow-hidden relative transition-opacity disabled:opacity-60"
              style={{ border: `1px solid ${isVoted ? 'var(--theme-primary)' : 'var(--theme-border)'}` }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  background: isVoted
                    ? 'rgba(197,168,128,0.18)'
                    : 'rgba(255,255,255,0.04)',
                }}
              />
              <div className="relative flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2" style={{ color: 'var(--theme-text)' }}>
                  {isVoted && (
                    <CheckCircle2 size={13} style={{ color: 'var(--theme-primary)', flexShrink: 0 }} />
                  )}
                  {option.text}
                </span>
                <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--theme-text-muted)' }}>
                  {percentage}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
        <span>{totalVotes === 1 ? t('poll.vote') : t('poll.votes', { count: totalVotes })}</span>
        {hasEnded ? (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {t('poll.ended')}
          </span>
        ) : poll.endsAt ? (
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {t('poll.ends', { date: formatDate(poll.endsAt) })}
          </span>
        ) : null}
      </div>
    </div>
  );
}
