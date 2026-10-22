'use client';

import { useTranslations } from 'next-intl';
import { useToggleReaction } from '@/hooks/use-feed';
import { useAuth } from '@/hooks/use-auth';
import type { Post } from '@community/shared';

const REACTIONS = [
  { type: 'LIKE', emoji: '👍', label: 'Like' },
  { type: 'HEART', emoji: '❤️', label: 'Heart' },
  { type: 'CELEBRATE', emoji: '🎉', label: 'Celebrate' },
  { type: 'INSIGHTFUL', emoji: '💡', label: 'Insightful' },
];

interface ReactionBarProps {
  post: Post;
}

export function ReactionBar({ post }: ReactionBarProps) {
  const t = useTranslations('feed');
  const { user } = useAuth();
  const toggleReaction = useToggleReaction(post.id);

  const userReactions = new Set(
    (post.reactions || []).filter((r) => r.userId === user?.id).map((r) => r.type)
  );

  const reactionCounts = REACTIONS.map((r) => ({
    ...r,
    count: (post.reactions || []).filter((reaction) => reaction.type === r.type).length,
    active: userReactions.has(r.type as any),
  }));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {reactionCounts.map((reaction) => (
        <button
          key={reaction.type}
          onClick={() => toggleReaction.mutate(reaction.type)}
          className="flex items-center gap-1 py-1 px-2 rounded-lg text-xs transition-all duration-150"
          style={{
            background: reaction.active ? 'rgba(197,168,128,0.15)' : 'transparent',
            border: `1px solid ${reaction.active ? 'rgba(197,168,128,0.3)' : 'transparent'}`,
            color: reaction.active ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
          }}
          title={t(`reactions.${reaction.type}`)}
        >
          <span>{reaction.emoji}</span>
          {reaction.count > 0 && <span>{reaction.count}</span>}
        </button>
      ))}
    </div>
  );
}
