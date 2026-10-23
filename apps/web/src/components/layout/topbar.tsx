'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Search, Menu, User, Settings, LogOut, Bookmark, Mail, Smartphone } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeSwitcher } from './theme-switcher';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@community/shared';
import { isPathEnabled } from '@/lib/capabilities';

interface TopbarProps {
  title?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const [insideAndroidApp, setInsideAndroidApp] = useState(false);

  useEffect(() => {
    // Android System WebView includes `; wv)` in its user agent.
    // The explicit marker also supports future native wrappers.
    setInsideAndroidApp(/;\s*wv\)|CommunityAndroidWebView/i.test(navigator.userAgent));
  }, []);
  const t = useTranslations('topbar');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');

  const openPalette = () =>
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));

  return (
    <header
      className="fixed top-0 right-0 left-0 lg:left-[280px] z-30 flex items-center gap-3 px-4 lg:px-6 h-16"
      style={{
        background: 'rgba(9,13,22,0.8)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--theme-border)',
      }}
    >
      {/* Hamburger — mobile only */}
      <button
        className="lg:hidden p-2 rounded-md hover:bg-white/5 flex-shrink-0"
        onClick={onMenuClick}
        aria-label={t('openMenu')}
      >
        <Menu size={20} style={{ color: 'var(--theme-text-muted)' }} />
      </button>

      {title && (
        <h1 className="text-lg font-semibold mr-auto" style={{ color: 'var(--theme-text)' }}>
          {title}
        </h1>
      )}

      {/* Command palette trigger */}
      <button
        onClick={openPalette}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors flex-1 max-w-xs lg:max-w-sm"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid var(--theme-border)',
          color: 'var(--theme-text-muted)',
        }}
      >
        <Search size={14} />
        <span className="flex-1 text-left text-sm hidden sm:inline">{t('searchPlaceholder')}</span>
        <kbd
          className="text-xs px-1.5 py-0.5 rounded font-mono hidden sm:inline"
          style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--theme-text-muted)' }}
        >
          ⌘K
        </kbd>
      </button>

      <ThemeSwitcher />

      <NotificationBell />

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button data-testid="user-menu-trigger" className="flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2">
            <Avatar className="h-8 w-8 cursor-pointer">
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{user?.email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="gap-2 cursor-pointer">
            <Link href={`/members/${user?.id}`}>
              <User size={14} />
              {t('myProfile')}
            </Link>
          </DropdownMenuItem>
          {isPathEnabled("/bookmarks") && <DropdownMenuItem asChild className="gap-2 cursor-pointer">
            <Link href="/bookmarks">
              <Bookmark size={14} />
              {tn('bookmarks')}
            </Link>
          </DropdownMenuItem>}
          {isPathEnabled("/messages") && <DropdownMenuItem asChild className="gap-2 cursor-pointer">
            <Link href="/messages">
              <Mail size={14} />
              {tn('messages')}
            </Link>
          </DropdownMenuItem>}
          <DropdownMenuItem asChild className="gap-2 cursor-pointer">
            <Link href="/settings">
              <Settings size={14} />
              {t('settings')}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {!insideAndroidApp && (
            <DropdownMenuItem asChild className="gap-2 cursor-pointer">
              <Link href="/get-app">
                <Smartphone size={14} />
                {tn('getTheApp')}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => logout()}
            className="gap-2 cursor-pointer"
            style={{ color: 'var(--theme-danger)' }}
          >
            <LogOut size={14} />
            {tc('signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
