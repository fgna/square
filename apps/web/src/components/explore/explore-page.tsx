'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Loader2,
  FileText,
  GraduationCap,
  Calendar,
  ArrowRight,
  Sparkles,
  Users,
  Lightbulb,
  Target,
  Heart,
  TrendingUp,
  Briefcase,
  Globe,
  Rocket,
  Gem,
  Brain,
  Layers,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import apiClient from '@/lib/api-client';
import { useInterests } from '@/hooks/use-interests';
import { getInitials } from '@community/shared';

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  ai: Sparkles,
  leadership: Gem,
  strategy: Target,
  innovation: Rocket,
  development: TrendingUp,
  wellbeing: Heart,
  wellness: Heart,
  teamwork: Users,
  culture: Globe,
  productivity: Lightbulb,
  business: Briefcase,
  technology: Brain,
  learning: GraduationCap,
  general: Layers,
};

function getCategoryIcon(slug: string, name: string): LucideIcon {
  if (CATEGORY_ICONS[slug]) return CATEGORY_ICONS[slug];
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return Layers;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  _count: { posts: number; courses: number; events: number };
}

export function ExplorePage() {
  const t = useTranslations('explore');
  const locale = useLocale() === 'de' ? 'de-DE' : 'en-US';
  const [selected, setSelected] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/categories').then((r) => r.data),
  });

  // Themes and interests are the same categories. A member's interests come
  // first and are marked, so the page starts with what they chose.
  const { data: interests, isLoading: interestsLoading } = useInterests();
  const interestIds = new Set((interests ?? []).map((i) => i.id));
  const mine = (categories ?? []).filter((cat) => interestIds.has(cat.id));
  const others = (categories ?? []).filter((cat) => !interestIds.has(cat.id));

  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['category-content', selected],
    queryFn: () =>
      apiClient
        .get(`/categories/${selected}/content`, { params: { limit: 10 } })
        .then((r) => r.data),
    enabled: !!selected,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
        </div>
      ) : (
        <>
          {!interestsLoading && mine.length === 0 && (
            <p className="text-sm rounded-lg px-4 py-3" style={{ color: 'var(--theme-text-muted)', background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              {t('noInterests')}{' '}
              <Link href="/settings#interests" className="font-medium hover:underline" style={{ color: 'var(--theme-primary)' }}>
                {t('chooseInterests')}
              </Link>
            </p>
          )}

          {[
            { key: 'mine', title: t('yourInterests'), items: mine },
            { key: 'others', title: mine.length ? t('otherTopics') : undefined, items: others },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.key} className="space-y-3">
                {group.title && (
                  <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
                    {group.title}
                  </h2>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {group.items.map((cat) => {
                    const total = cat._count.posts + cat._count.courses + cat._count.events;
                    const isActive = selected === cat.slug;
                    return (
                      (() => {
                        const Icon = getCategoryIcon(cat.slug, cat.name);
                        const accent = cat.color || 'var(--theme-primary)';
                        return (
                          <Link
                            key={cat.id}
                            href={`/explore/${cat.slug}`}
                            onClick={() => setSelected(isActive ? null : cat.slug)}
                            className="group flex flex-col items-center gap-3 p-5 rounded-xl transition-all text-center hover:scale-[1.02]"
                            style={{
                              background: isActive
                                ? `${accent}18`
                                : 'var(--theme-card)',
                              border: isActive
                                ? `1px solid ${accent}40`
                                : group.key === 'mine'
                                  ? '1px solid rgba(197,168,128,0.35)'
                                  : '1px solid var(--theme-border)',
                            }}
                          >
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center transition-all group-hover:scale-110"
                              style={{
                                background: isActive ? `${accent}20` : 'rgba(197,168,128,0.08)',
                                color: isActive ? accent : 'var(--theme-primary)',
                              }}
                            >
                              <Icon size={20} />
                            </div>
                            <span
                              className="text-sm font-semibold"
                              style={{ color: isActive ? accent : 'var(--theme-text)' }}
                            >
                              {cat.name}
                            </span>
                            <span className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                              {t(total === 1 ? 'itemsOne' : 'itemsOther', { count: total })}
                            </span>
                          </Link>
                        );
                      })()
                    );
                  })}
                </div>
              </section>
            ))}

          {/* Content for selected category */}
          {selected && (
            <div className="space-y-4">
              {contentLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
                </div>
              ) : (
                <>
                  {content?.posts?.length > 0 && (
                    <ContentSection title={t('posts')} icon={FileText} count={content.posts.length}>
                      {content.posts.map((p: any) => (
                        <Link
                          key={p.id}
                          href={`/feed/${p.id}`}
                          className="block p-3 rounded-lg transition-colors hover:bg-white/5"
                        >
                          <p className="text-sm line-clamp-2" style={{ color: 'var(--theme-text)' }}>
                            {p.content.replace(/<[^>]*>/g, '').slice(0, 180)}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={p.author?.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-[8px]">{getInitials(p.author?.name || 'U')}</AvatarFallback>
                            </Avatar>
                            <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                              {p.author?.name}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </ContentSection>
                  )}

                  {content?.courses?.length > 0 && (
                    <ContentSection title={t('courses')} icon={GraduationCap} count={content.courses.length}>
                      {content.courses.map((c: any) => (
                        <Link
                          key={c.id}
                          href="/courses"
                          className="flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-white/5"
                        >
                          <GraduationCap size={16} style={{ color: 'var(--theme-primary)' }} />
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
                          <ArrowRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
                        </Link>
                      ))}
                    </ContentSection>
                  )}

                  {content?.events?.length > 0 && (
                    <ContentSection title={t('events')} icon={Calendar} count={content.events.length}>
                      {content.events.map((e: any) => (
                        <Link
                          key={e.id}
                          href="/events"
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
                          </div>
                        </Link>
                      ))}
                    </ContentSection>
                  )}

                  {!content?.posts?.length && !content?.courses?.length && !content?.events?.length && (
                    <div
                      className="text-center py-12 rounded-xl"
                      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
                    >
                      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                        {t('empty')}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ContentSection({
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
