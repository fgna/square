'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Search,
  FileText,
  User,
  GraduationCap,
  Calendar,
  Play,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api-client';
import { getInitials } from '@community/shared';

type Category = 'all' | 'posts' | 'members' | 'events' | 'courses' | 'recordings';

const CATEGORIES: { value: Category; icon: React.ElementType }[] = [
  { value: 'all', icon: Search },
  { value: 'posts', icon: FileText },
  { value: 'members', icon: User },
  { value: 'events', icon: Calendar },
  { value: 'courses', icon: GraduationCap },
  { value: 'recordings', icon: Play },
];

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ');
}

function formatDate(date: string, locale: string): string {
  return new Date(date).toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchPage() {
  const t = useTranslations('search');
  const locale = useLocale() === 'de' ? 'de-DE' : 'en-US';
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get('q') || '';
  const [query, setQuery] = useState(initialQ);
  const [category, setCategory] = useState<Category>('all');
  const debouncedQ = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQ) {
      router.replace(`/search?q=${encodeURIComponent(debouncedQ)}`, { scroll: false });
    }
  }, [debouncedQ, router]);

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () =>
      apiClient.get('/search', { params: { q: debouncedQ, limit: 20 } }).then((r) => r.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const posts = data?.posts ?? [];
  const users = data?.users ?? [];
  const events = data?.events ?? [];
  const courses = data?.courses ?? [];
  const recordings = data?.recordings ?? [];

  const totalResults =
    posts.length + users.length + events.length + courses.length + recordings.length;

  const counts: Record<Category, number> = {
    all: totalResults,
    posts: posts.length,
    members: users.length,
    events: events.length,
    courses: courses.length,
    recordings: recordings.length,
  };

  const showPosts = (category === 'all' || category === 'posts') && posts.length > 0;
  const showMembers = (category === 'all' || category === 'members') && users.length > 0;
  const showEvents = (category === 'all' || category === 'events') && events.length > 0;
  const showCourses = (category === 'all' || category === 'courses') && courses.length > 0;
  const showRecordings = (category === 'all' || category === 'recordings') && recordings.length > 0;
  const noResults =
    debouncedQ.length >= 2 && !isLoading && !showPosts && !showMembers && !showEvents && !showCourses && !showRecordings;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Search input */}
      <div>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--theme-text-muted)' }}
          />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="pl-11 h-12 text-base"
          />
        </div>
      </div>

      {/* Category tabs */}
      {debouncedQ.length >= 2 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {CATEGORIES.map(({ value, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setCategory(value)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background: category === value ? 'rgba(197,168,128,0.12)' : 'transparent',
                color: category === value ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                border: category === value ? '1px solid rgba(197,168,128,0.2)' : '1px solid transparent',
              }}
            >
              <Icon size={13} />
              {t(value)}
              {counts[value] > 0 && (
                <span
                  className="ml-1 px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  {counts[value]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {isLoading && debouncedQ.length >= 2 && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
        </div>
      )}

      {/* No results */}
      {noResults && (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
        >
          <Search size={36} className="mx-auto mb-3" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
          <p className="font-medium" style={{ color: 'var(--theme-text)' }}>
            {t('noResults', { query: debouncedQ })}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t('noResultsText')}
          </p>
        </div>
      )}

      {/* Prompt */}
      {debouncedQ.length < 2 && !isLoading && (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
        >
          <Search size={36} className="mx-auto mb-3" style={{ color: 'var(--theme-text-muted)', opacity: 0.3 }} />
          <p className="font-medium" style={{ color: 'var(--theme-text)' }}>
            {t('promptTitle')}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t('promptText')}
          </p>
        </div>
      )}

      {/* Results */}
      {!isLoading && (
        <div className="space-y-6">
          {/* Members */}
          {showMembers && (
            <Section title={t('members')} icon={User} count={users.length}>
              {users.map((u: any) => (
                <Link
                  key={u.id}
                  href={`/members/${u.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                >
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={u.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {u.name}
                    </p>
                    {u.bio && (
                      <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        {u.bio}
                      </p>
                    )}
                  </div>
                  {u.role === 'ADMIN' && <Badge className="text-[10px] py-0">{t('admin')}</Badge>}
                </Link>
              ))}
            </Section>
          )}

          {/* Posts */}
          {showPosts && (
            <Section title={t('posts')} icon={FileText} count={posts.length}>
              {posts.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/feed/${p.id}`}
                  className="block p-3 rounded-lg transition-colors hover:bg-white/5"
                >
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--theme-text)' }}>
                    {stripHtml(p.content).slice(0, 200)}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      by {p.author?.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      · {formatDate(p.createdAt, locale)}
                    </span>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Events */}
          {showEvents && (
            <Section title={t('events')} icon={Calendar} count={events.length}>
              {events.map((e: any) => (
                <Link
                  key={e.id}
                  href={`/events`}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-center"
                    style={{ background: 'rgba(197,168,128,0.1)', color: 'var(--theme-primary)' }}
                  >
                    <span className="text-[10px] font-medium leading-none">
                      {new Date(e.startsAt).toLocaleDateString(locale, { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold leading-none">
                      {new Date(e.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {e.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {e.isVirtual ? t('virtual') : e.description?.slice(0, 60)}
                    </p>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Courses */}
          {showCourses && (
            <Section title={t('courses')} icon={GraduationCap} count={courses.length}>
              {courses.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/courses`}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.1)' }}
                  >
                    <GraduationCap size={18} style={{ color: 'var(--theme-secondary, #6366f1)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {c.title}
                    </p>
                    {c.description && (
                      <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                        {c.description.slice(0, 80)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {/* Recordings */}
          {showRecordings && (
            <Section title={t('recordings')} icon={Play} count={recordings.length}>
              {recordings.map((r: any) => (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(197,168,128,0.1)' }}
                  >
                    <Play size={16} style={{ color: 'var(--theme-primary)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {r.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {r.event?.title} · {formatDate(r.event?.startsAt, locale)}
                    </p>
                  </div>
                  <ExternalLink size={13} style={{ color: 'var(--theme-text-muted)', flexShrink: 0 }} />
                </a>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <Icon size={14} style={{ color: 'var(--theme-primary)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {title}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--theme-text-muted)' }}
        >
          {count}
        </span>
      </div>
      <div className="divide-y" style={{ borderColor: 'var(--theme-border)' }}>
        {children}
      </div>
    </div>
  );
}
