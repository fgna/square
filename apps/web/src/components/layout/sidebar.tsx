'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Home, MessageCircle, GraduationCap, Calendar, Users, Shield, LogOut, ChevronRight, X, Play, Compass, Star, BookOpen, BarChart3, UsersRound, Bookmark, Bot, ClipboardList, Heart, Lightbulb, ListChecks, MessageSquare, NotebookPen, Sparkles, Target, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@community/shared';
import type { LucideIcon } from 'lucide-react';
import { useBranding } from '@/hooks/use-branding';
import { LegalLinks } from '@/components/common/legal-links';
import type { NavGroup, NavIcon } from '@community/plugin-sdk';
import { pluginNavItems, type PluginNavItem } from '@/plugins';

// labelKey is below "nav" for the Core's entries and a full key for plugins'.
type NavItem = { href: string; labelKey: string; icon: LucideIcon; plugin?: boolean };
type NavGroupDef = { id: NavGroup; headingKey?: string; items: NavItem[] };

// Icons plugins can choose (NavIcon in the plugin SDK).
const pluginIcons: Record<NavIcon, LucideIcon> = {
  BookOpen, BarChart3, Bot, Calendar, ClipboardList, Compass, Heart, Lightbulb,
  ListChecks, MessageSquare, NotebookPen, Sparkles, Target, Trophy,
};

// Grouped by purpose. Everything where members meet each other stands
// together; before, forum, groups, testimonials and members were spread
// from the top to the bottom of the list.
export const navGroups: NavGroupDef[] = [
  { id: 'main', items: [{ href: '/dashboard', labelKey: 'dashboard', icon: Home }] },
  {
    id: 'together',
    headingKey: 'groupTogether',
    items: [
      // The forum holds questions and success stories as tabs; they no longer have entries of their own.
      { href: '/feed', labelKey: 'feed', icon: MessageCircle },
      { href: '/members', labelKey: 'members', icon: Users },
      { href: '/testimonials', labelKey: 'testimonials', icon: Star },
      { href: '/learning-groups', labelKey: 'learningGroups', icon: UsersRound },
      // Saved posts were reachable only through the avatar menu, where members did not look.
      { href: '/bookmarks', labelKey: 'bookmarks', icon: Bookmark },
    ],
  },
  {
    id: 'learning',
    headingKey: 'groupLearning',
    items: [
      // Start by knowing where you stand, reflect on it, then learn.
      // The journal comes in between as a built-in plugin (plugins/bundled/journal).
      { href: '/assessment', labelKey: 'assessment', icon: BarChart3 },
      { href: '/courses', labelKey: 'courses', icon: GraduationCap },
    ],
  },
  {
    // Recordings are the events afterwards, so they stand with them.
    id: 'live',
    headingKey: 'groupLive',
    items: [
      { href: '/events', labelKey: 'events', icon: Calendar },
      { href: '/recordings', labelKey: 'recordings', icon: Play },
    ],
  },
  { id: 'more', items: [{ href: '/explore', labelKey: 'explore', icon: Compass }] },
  // Settings live in the avatar menu (top right); listing them here as well was a duplicate.
];

/** Places plugin entries in their group: at index `order`, or after the Core's entries. */
export function withPluginEntries(groups: NavGroupDef[], entries: PluginNavItem[]): NavGroupDef[] {
  return groups.map((group) => {
    const extra = entries
      .filter((e) => e.group === group.id)
      .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
    if (!extra.length) return group;
    const items = [...group.items];
    for (const e of extra) {
      items.splice(e.order ?? items.length, 0, { href: e.href, labelKey: e.messageKey, icon: pluginIcons[e.icon], plugin: true });
    }
    return { ...group, items };
  });
}

export const groupsWithPlugins = withPluginEntries(navGroups, pluginNavItems());

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const { data: branding } = useBranding();

  return (
    <aside
      className={`fixed left-0 top-0 h-full flex flex-col z-40 transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      style={{
        width: 'var(--sidebar-width)',
        background: 'var(--theme-surface)',
        backdropFilter: 'blur(var(--theme-blur))',
        WebkitBackdropFilter: 'blur(var(--theme-blur))',
        borderRight: '1px solid var(--theme-border)',
      }}
    >
      {/* Logo */}
      {/* Name and logo come from Admin → Settings; this used to say
          "Community" whatever was configured. A logo usually carries the
          name itself, so it is shown alone. */}
      <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid var(--theme-border)' }}>
        {branding?.logoUrl ? (
          <img
            src={branding.logoUrl}
            alt={branding.platformName}
            className="h-9 max-w-[180px] object-contain flex-1 object-left"
          />
        ) : (
          <>
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--theme-primary)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--theme-background)">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
            <span className="font-bold text-base flex-1" style={{ color: 'var(--theme-text)' }}>
              {branding?.platformName ?? tc('community')}
            </span>
          </>
        )}
        {/* Close button — mobile only */}
        <button
          className="lg:hidden p-1.5 rounded-md hover:bg-white/5"
          onClick={onClose}
          aria-label={t('closeMenu')}
        >
          <X size={18} style={{ color: 'var(--theme-text-muted)' }} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {groupsWithPlugins.map(({ headingKey, items }, i) => (
          <div key={headingKey ?? i} className={i > 0 ? 'pt-3 space-y-1' : 'space-y-1'}>
            {headingKey && (
              <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', opacity: 0.6 }}>
                {t(headingKey)}
              </p>
            )}
            {items.map(({ href, labelKey, icon: Icon, plugin }) => {
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group"
                  style={{
                    background: isActive ? 'rgba(197,168,128,0.12)' : 'transparent',
                    color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                    border: isActive ? '1px solid rgba(197,168,128,0.2)' : '1px solid transparent',
                  }}
                >
                  <Icon size={18} className="flex-shrink-0" />
                  <span className="flex-1">{plugin ? tAll(labelKey) : t(labelKey)}</span>
                  {isActive && <ChevronRight size={14} />}
                </Link>
              );
            })}
          </div>
        ))}

        {user?.role === 'ADMIN' && (
          <>
            <div className="pt-2 pb-1">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)', opacity: 0.6 }}>
                {t('admin')}
              </p>
            </div>
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150"
              style={{
                background: pathname.startsWith('/admin') ? 'rgba(197,168,128,0.12)' : 'transparent',
                color: pathname.startsWith('/admin') ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                border: pathname.startsWith('/admin') ? '1px solid rgba(197,168,128,0.2)' : '1px solid transparent',
              }}
            >
              <Shield size={18} className="flex-shrink-0" />
              <span className="flex-1">{t('adminPanel')}</span>
            </Link>
          </>
        )}
      </nav>

      {/* User profile */}
      <div className="p-4" style={{ borderTop: '1px solid var(--theme-border)' }}>
        <div className="flex items-center gap-3 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md transition-colors hover:bg-white/5"
            aria-label={tc('signOut')}
            title={tc('signOut')}
          >
            <LogOut size={14} style={{ color: 'var(--theme-text-muted)' }} />
          </button>
        </div>
        <LegalLinks className="mt-3" />
      </div>
    </aside>
  );
}
