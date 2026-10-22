'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useMembers } from '@/hooks/use-members';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, Trophy } from 'lucide-react';
import { MemberCard } from './member-card';
import { getInitials } from '@community/shared';
import type { User } from '@community/shared';

type MemberWithCount = User & { _count?: { posts: number; courseProgress: number } };

function Leaderboard({ members }: { members: MemberWithCount[] }) {
  const t = useTranslations('members');
  const top = [...members]
    .sort((a, b) => (b._count?.posts ?? 0) - (a._count?.posts ?? 0))
    .slice(0, 5);

  const medals = ['🥇', '🥈', '🥉', '4.', '5.'];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Trophy size={14} style={{ color: 'var(--theme-primary)' }} />
          {t('topContributors')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {top.map((m, i) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderTop: i > 0 ? '1px solid var(--theme-border)' : undefined }}
          >
            <span className="text-sm w-5 text-center flex-shrink-0">{medals[i]}</span>
            <Avatar className="h-7 w-7 flex-shrink-0">
              <AvatarFallback className="text-xs">{getInitials(m.name)}</AvatarFallback>
            </Avatar>
            <p className="flex-1 text-sm truncate" style={{ color: 'var(--theme-text)' }}>{m.name}</p>
            <span className="text-xs flex-shrink-0" style={{ color: 'var(--theme-primary)' }}>
              {t('posts', { count: m._count?.posts ?? 0 })}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MembersPage() {
  const t = useTranslations('members');
  const { data, isLoading, error } = useMembers(1, 50);
  const [search, setSearch] = useState('');

  const members: MemberWithCount[] = data?.data ?? data?.users ?? [];
  const total: number = data?.total ?? members.length;
  const filtered = members.filter((m) => m.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t(total === 1 ? 'countOne' : 'countOther', { count: total })}
          </p>
        </div>
        <div className="relative max-w-xs">
          <Input
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-6 items-start">
        {/* Member grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p style={{ color: 'var(--theme-danger)' }}>{t('loadError')}</p>
              </CardContent>
            </Card>
          ) : !members.length ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Users size={40} className="mx-auto mb-3" style={{ color: 'var(--theme-text-muted)' }} />
                <p className="font-medium" style={{ color: 'var(--theme-text)' }}>{t('empty')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((member) => (
                <MemberCard key={member.id} member={member} />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        {!isLoading && members.length > 0 && (
          <div className="w-64 flex-shrink-0 hidden lg:block">
            <Leaderboard members={members} />
          </div>
        )}
      </div>
    </div>
  );
}
