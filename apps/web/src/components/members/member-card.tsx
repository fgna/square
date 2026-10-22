import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';
import type { User } from '@community/shared';

interface MemberCardProps {
  member: User & { _count?: { posts: number; courseProgress: number } };
}

function getMemberBadge(postCount: number): { emoji: string; label: string } | null {
  if (postCount >= 51) return { emoji: '💎', label: 'badgeDiamond' };
  if (postCount >= 21) return { emoji: '🔥', label: 'badgeActive' };
  if (postCount >= 6) return { emoji: '⭐', label: 'badgeRising' };
  if (postCount >= 1) return { emoji: '🌱', label: 'badgeSeedling' };
  return null;
}

export function MemberCard({ member }: MemberCardProps) {
  const t = useTranslations('members');
  const { formatDate } = useFormatters();
  const badge = getMemberBadge(member._count?.posts ?? 0);

  return (
    <Link href={`/members/${member.id}`}>
    <Card className="hover:border-[var(--theme-primary)] transition-all duration-200 cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 flex-shrink-0">
            <AvatarImage src={member.avatarUrl || undefined} />
            <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm truncate" style={{ color: 'var(--theme-text)' }}>
                {member.name}
              </p>
              {member.role === 'ADMIN' && <Badge className="text-xs py-0 px-1.5">{t('admin')}</Badge>}
              {badge && (
                <span title={t(badge.label)} className="text-sm leading-none flex-shrink-0">{badge.emoji}</span>
              )}
            </div>
            {member.bio && (
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
                {member.bio}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {member._count && (
                <>
                  <span>{t('posts', { count: member._count.posts })}</span>
                  <span>·</span>
                  <span>{t('courses', { count: member._count.courseProgress })}</span>
                </>
              )}
              <span className="ml-auto">{t('joined', { date: formatDate(member.createdAt, { month: 'short', year: 'numeric', day: undefined }) })}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    </Link>
  );
}
