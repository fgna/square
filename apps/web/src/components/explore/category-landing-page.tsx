'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCategory, useCategoryContent } from '@/hooks/use-categories';
import {
  Loader2,
  ArrowLeft,
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
import { useTranslations } from 'next-intl';
import { getInitials } from '@community/shared';
import { useFormatters } from '@/lib/use-formatters';

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

export function CategoryLandingPage() {
  const t = useTranslations('explore');
  const { locale, timeAgo } = useFormatters();
  const { slug } = useParams<{ slug: string }>();
  const { data: category, isLoading: catLoading } = useCategory(slug);
  const { data: content, isLoading: contentLoading } = useCategoryContent(slug);

  if (catLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center animate-fade-in">
        <p className="text-lg font-medium" style={{ color: 'var(--theme-text)' }}>
          {t('notFound')}
        </p>
        <Link
          href="/explore"
          className="inline-flex items-center gap-1.5 mt-4 text-sm"
          style={{ color: 'var(--theme-primary)' }}
        >
          <ArrowLeft size={14} /> {t('back')}
        </Link>
      </div>
    );
  }

  const color = category.color || 'var(--theme-primary)';
  const postCount = category._count?.posts ?? 0;
  const courseCount = category._count?.courses ?? 0;
  const eventCount = category._count?.events ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Back link */}
      <Link
        href="/explore"
        className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        <ArrowLeft size={14} /> {t('allCategories')}
      </Link>

      {/* Header */}
      <div
        className="rounded-xl p-6 space-y-3"
        style={{
          background: `${color}10`,
          border: `1px solid ${color}30`,
        }}
      >
        <div className="flex items-center gap-3">
          {(() => {
            const Icon = getCategoryIcon(slug, category.name);
            return (
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}20`, color }}
              >
                <Icon size={24} />
              </div>
            );
          })()}
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
              {category.name}
            </h1>
            {category.description && (
              <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                {category.description}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <StatBadge text={t('postsCount', { count: postCount })} color={color} />
          <StatBadge text={t('coursesCount', { count: courseCount })} color={color} />
          <StatBadge text={t('eventsCount', { count: eventCount })} color={color} />
        </div>
      </div>

      {/* Content */}
      {contentLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
        </div>
      ) : (
        <div className="space-y-5">
          {content?.posts?.length > 0 && (
            <Section title={t('posts')} icon={FileText} count={content.posts.length} color={color}>
              {content.posts.map((p: any) => (
                <Link
                  key={p.id}
                  href={`/feed/${p.id}`}
                  className="block p-4 transition-colors hover:bg-white/5"
                >
                  <p className="text-sm line-clamp-2" style={{ color: 'var(--theme-text)' }}>
                    {p.content.replace(/<[^>]*>/g, '').slice(0, 200)}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={p.author?.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(p.author?.name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {p.author?.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}>
                      ·
                    </span>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {timeAgo(p.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {content?.courses?.length > 0 && (
            <Section title={t('courses')} icon={GraduationCap} count={content.courses.length} color={color}>
              {content.courses.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/courses/${c.id}`}
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5"
                >
                  <GraduationCap size={16} style={{ color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {c.title}
                    </p>
                    {c.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                        {c.description.slice(0, 100)}
                      </p>
                    )}
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--theme-text-muted)' }} />
                </Link>
              ))}
            </Section>
          )}

          {content?.events?.length > 0 && (
            <Section title={t('events')} icon={Calendar} count={content.events.length} color={color}>
              {content.events.map((e: any) => (
                <Link
                  key={e.id}
                  href="/events"
                  className="flex items-center gap-3 p-4 transition-colors hover:bg-white/5"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 text-center"
                    style={{ background: `${color}15`, color }}
                  >
                    <span className="text-[10px] font-medium leading-none">
                      {new Date(e.startsAt).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', { month: 'short' })}
                    </span>
                    <span className="text-sm font-bold leading-none">
                      {new Date(e.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>
                      {e.title}
                    </p>
                    {e.description && (
                      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                        {e.description.slice(0, 80)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {!content?.posts?.length && !content?.courses?.length && !content?.events?.length && (
            <div
              className="text-center py-16 rounded-xl"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
                {t('empty')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBadge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: `${color}18`, color }}
    >
      {text}
    </span>
  );
}

function Section({
  title,
  icon: Icon,
  count,
  color,
  children,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        <Icon size={14} style={{ color }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
          {title}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{ background: `${color}15`, color }}
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
