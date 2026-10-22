'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, MessageCircle, BookOpen, UserPlus, UserMinus, ArrowLeft, Mail } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';
import { useGetOrCreateConversation } from '@/hooks/use-messages';

interface MemberProfile {
  id: string;
  name: string;
  bio?: string | null;
  avatarUrl?: string | null;
  role: string;
  createdAt: string;
  isFollowing: boolean;
  _count: { posts: number; courseProgress: number; followers: number; following: number };
}

export default function MemberProfilePage() {
  const t = useTranslations('members');
  const { formatDate } = useFormatters();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const startConversation = useGetOrCreateConversation();

  const { data: member, isLoading } = useQuery<MemberProfile>({
    queryKey: ['member', id],
    queryFn: () => apiClient.get(`/users/${id}`).then((r) => r.data),
    enabled: !!id,
  });

  const follow = useMutation({
    mutationFn: () => apiClient.post(`/users/${id}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member', id] }),
  });

  const unfollow = useMutation({
    mutationFn: () => apiClient.delete(`/users/${id}/follow`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['member', id] }),
  });

  const isOwnProfile = user?.id === id;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
        <Skeleton className="h-32 w-32 rounded-full mx-auto" />
        <Skeleton className="h-6 w-48 mx-auto" />
        <Skeleton className="h-4 w-64 mx-auto" />
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <Link href="/members" className="flex items-center gap-2 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        <ArrowLeft size={14} /> {t('back')}
      </Link>

      {/* Profile card */}
      <div
        className="rounded-2xl p-8 text-center space-y-4"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <Avatar className="h-24 w-24 mx-auto">
          <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
          <AvatarFallback className="text-2xl">{getInitials(member.name)}</AvatarFallback>
        </Avatar>

        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <h1 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{member.name}</h1>
            {member.role === 'ADMIN' && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/20 text-xs">{t('admin')}</Badge>
            )}
          </div>
          {member.bio && (
            <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--theme-text-muted)' }}>{member.bio}</p>
          )}
          <p className="text-xs mt-2" style={{ color: 'var(--theme-text-muted)' }}>
            {t('joined', { date: formatDate(member.createdAt) })}
          </p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8">
          {[
            { icon: MessageCircle, label: t('statPosts'), value: member._count.posts },
            { icon: BookOpen, label: t('statCourses'), value: member._count.courseProgress },
            { icon: Users, label: t('statFollowers'), value: member._count.followers },
            { icon: UserPlus, label: t('statFollowing'), value: member._count.following },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="text-center">
              <p className="text-lg font-bold" style={{ color: 'var(--theme-text)' }}>{value}</p>
              <p className="text-xs flex items-center gap-1 justify-center" style={{ color: 'var(--theme-text-muted)' }}>
                <Icon size={11} /> {label}
              </p>
            </div>
          ))}
        </div>

        {!isOwnProfile && (
          <div className="flex items-center justify-center gap-2">
            <Button
              size="sm"
              onClick={() => member.isFollowing ? unfollow.mutate() : follow.mutate()}
              disabled={follow.isPending || unfollow.isPending}
              variant={member.isFollowing ? 'outline' : 'default'}
              className="flex items-center gap-2"
              style={
                member.isFollowing
                  ? { borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }
                  : { background: 'var(--theme-primary)', color: 'var(--theme-background)' }
              }
            >
              {member.isFollowing
                ? <><UserMinus size={14} /> {t('unfollow')}</>
                : <><UserPlus size={14} /> {t('follow')}</>}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex items-center gap-2"
              disabled={startConversation.isPending}
              onClick={() =>
                startConversation.mutate(id, {
                  onSuccess: (conv) => router.push(`/messages?conv=${conv.id}`),
                })
              }
            >
              <Mail size={14} /> {t('message')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
