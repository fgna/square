'use client';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import {
  Home, MessageCircle, GraduationCap, Calendar, Users, Settings, Shield,
  Mail, Search, ArrowRight, LogOut, FileText, BarChart2, User,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@community/shared';
import { isPathEnabled } from '@/lib/capabilities';

interface NavCommand {
  kind: 'nav';
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  adminOnly?: boolean;
}

interface SearchResult {
  kind: 'result';
  id: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  avatarUrl?: string | null;
  action: () => void;
}

type Item = NavCommand | SearchResult;

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function CommandPalette() {
  const t = useTranslations('commandPalette');
  const nav = useTranslations('nav');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user, logout } = useAuth();
  const debouncedQ = useDebounce(query, 250);

  const navigate = useCallback((path: string) => {
    setOpen(false);
    router.push(path);
  }, [router]);

  const navCommands: NavCommand[] = useMemo(() => [
    { kind: 'nav', id: 'home', label: nav('dashboard'), description: t('homeDesc'), icon: Home, action: () => navigate('/dashboard') },
    { kind: 'nav', id: 'feed', label: nav('feed'), description: t('feedDesc'), icon: MessageCircle, action: () => navigate('/feed') },
    { kind: 'nav', id: 'courses', label: nav('courses'), description: t('coursesDesc'), icon: GraduationCap, action: () => navigate('/courses') },
    { kind: 'nav', id: 'events', label: nav('events'), description: t('eventsDesc'), icon: Calendar, action: () => navigate('/events') },
    { kind: 'nav', id: 'members', label: nav('members'), description: t('membersDesc'), icon: Users, action: () => navigate('/members') },
    { kind: 'nav', id: 'messages', label: nav('messages'), description: t('messagesDesc'), icon: Mail, action: () => navigate('/messages') },
    { kind: 'nav', id: 'settings', label: nav('settings'), description: t('settingsDesc'), icon: Settings, action: () => navigate('/settings') },
    { kind: 'nav', id: 'admin', label: nav('adminPanel'), description: t('adminDesc'), icon: Shield, action: () => navigate('/admin'), adminOnly: true },
    { kind: 'nav', id: 'analytics', label: t('analytics'), description: t('analyticsDesc'), icon: BarChart2, action: () => navigate('/admin/analytics'), adminOnly: true },
    { kind: 'nav', id: 'logout', label: common('signOut'), description: t('logoutDesc'), icon: LogOut, action: () => { setOpen(false); logout(); } },
  ], [navigate, logout, t, nav, common]);

  const { data: searchData } = useQuery({
    queryKey: ['search', debouncedQ],
    queryFn: () => apiClient.get('/search', { params: { q: debouncedQ, limit: 5 } }).then(r => r.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 10_000,
  });

  const items: Item[] = useMemo(() => {
    const q = query.toLowerCase().trim();

    const filteredNav = navCommands.filter(cmd => {
      if (cmd.adminOnly && user?.role !== 'ADMIN') return false;
      if (!isPathEnabled(cmd.id === 'analytics' ? '/admin/analytics' : '/' + cmd.id)) return false;
      if (!q) return true;
      return cmd.label.toLowerCase().includes(q) || cmd.description?.toLowerCase().includes(q);
    });

    if (!debouncedQ || debouncedQ.length < 2 || !searchData) return filteredNav;

    const results: SearchResult[] = [];

    (searchData.users ?? []).forEach((u: any) => results.push({
      kind: 'result', id: `u-${u.id}`, label: u.name, sub: t('member'), icon: User,
      avatarUrl: u.avatarUrl, action: () => navigate(`/members/${u.id}`),
    }));

    (isPathEnabled('/feed') ? searchData.posts ?? [] : []).forEach((p: any) => results.push({
      kind: 'result', id: `p-${p.id}`,
      label: p.content.length > 60 ? p.content.slice(0, 60) + '…' : p.content,
      sub: t('postBy', { name: p.author?.name ?? '' }), icon: FileText,
      action: () => navigate('/feed'),
    }));

    (isPathEnabled('/courses') ? searchData.courses ?? [] : []).forEach((c: any) => results.push({
      kind: 'result', id: `c-${c.id}`, label: c.title, sub: t('course'), icon: GraduationCap,
      action: () => navigate('/courses'),
    }));

    (isPathEnabled('/events') ? searchData.events ?? [] : []).forEach((e: any) => results.push({
      kind: 'result', id: `e-${e.id}`, label: e.title, sub: t('event'), icon: Calendar,
      action: () => navigate('/events'),
    }));

    return [...results, ...filteredNav];
  }, [query, debouncedQ, searchData, navCommands, user?.role, navigate, t]);

  useEffect(() => { setActiveIdx(0); }, [items.length, debouncedQ]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        if (!open) setQuery('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { items[activeIdx]?.action(); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  if (!open) return null;

  const hasSearchResults = items.some(i => i.kind === 'result');

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--theme-border)' }}>
          <Search size={16} style={{ color: 'var(--theme-text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('placeholder')}
            className="flex-1 bg-transparent py-4 text-sm outline-none placeholder:opacity-50"
            style={{ color: 'var(--theme-text)' }}
          />
          <kbd className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--theme-surface)', color: 'var(--theme-text-muted)', border: '1px solid var(--theme-border)' }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="py-2 max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-4 py-6 text-center text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              {t('noResults')}
            </p>
          )}

          {hasSearchResults && (
            <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>
              {t('searchResults')}
            </p>
          )}

          {items.map((item, idx) => {
            const isActive = idx === activeIdx;
            const isFirstNav = item.kind === 'nav' && hasSearchResults && items.findIndex(i => i.kind === 'nav') === idx;
            const Icon = item.icon;
            const avatarUrl = item.kind === 'result' ? item.avatarUrl : undefined;
            const sub = item.kind === 'result' ? item.sub : item.description;

            return (
              <div key={item.id}>
                {isFirstNav && (
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                    {t('navigation')}
                  </p>
                )}
                <button
                  onClick={item.action}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors"
                  style={{
                    background: isActive ? 'rgba(197,168,128,0.1)' : 'transparent',
                    color: 'var(--theme-text)',
                  }}
                >
                  {avatarUrl !== undefined ? (
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={avatarUrl ?? undefined} />
                      <AvatarFallback className="text-xs">{getInitials(item.label)}</AvatarFallback>
                    </Avatar>
                  ) : (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isActive ? 'rgba(197,168,128,0.15)' : 'var(--theme-surface)' }}
                    >
                      <Icon size={15} style={{ color: isActive ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    {sub && <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{sub}</p>}
                  </div>
                  {isActive && <ArrowRight size={14} style={{ color: 'var(--theme-primary)', flexShrink: 0 }} />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 flex items-center gap-4 text-xs" style={{ borderTop: '1px solid var(--theme-border)', color: 'var(--theme-text-muted)' }}>
          <span><kbd className="font-mono">↑↓</kbd> {t('navigate')}</span>
          <span><kbd className="font-mono">↵</kbd> {t('open')}</span>
          <span><kbd className="font-mono">⌘K</kbd> {t('toggle')}</span>
        </div>
      </div>
    </div>
  );
}
