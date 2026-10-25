'use client';

import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/lib/theme-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogOut, Palette, User, Bell, Shield, Download, Trash2, Loader2, Mail, CalendarDays, AlarmClock, Sparkles, Link2, Unlink, CalendarPlus, Copy, Check, RefreshCw } from 'lucide-react';
import { InterestPicker } from './interest-picker';
import { LocaleSwitcher } from './locale-switcher';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';
import { avatarTooLargeMessage, shrinkAvatar } from '@/lib/avatar';
import { readLocalFile } from '@/lib/read-local-file';
import { useAuthStore } from '@/store/auth.store';
import { getGoogleOAuthUrl, getLinkedInOAuthUrl } from '@/lib/oauth';
import { useBillingStatus, useBillingCheckout, useBillingPortal } from '@/hooks/use-billing';

// Labels live in messages: settings.notifications.<key> and <key>Desc.
const DIGEST_OPTIONS = [
  { value: 'DAILY', key: 'daily' },
  { value: 'WEEKLY', key: 'weekly' },
  { value: 'NONE', key: 'off' },
] as const;

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const PROVIDERS = [
  { id: 'google', name: 'Google', getUrl: getGoogleOAuthUrl },
  { id: 'linkedin', name: 'LinkedIn', getUrl: getLinkedInOAuthUrl },
] as const;

function ConnectedAccountsCard() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery<{ id: string; provider: string; email?: string; createdAt: string }[]>({
    queryKey: ['oauth-accounts'],
    queryFn: () => apiClient.get('/auth/oauth/accounts').then((r) => r.data),
  });

  const unlinkMut = useMutation({
    mutationFn: (provider: string) => apiClient.delete(`/auth/oauth/unlink/${provider}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['oauth-accounts'] }),
  });

  const linked = new Set(accounts?.map((a) => a.provider) ?? []);
  const hasAnyProvider = PROVIDERS.some((p) => typeof window !== 'undefined' && p.getUrl());
  if (!hasAnyProvider) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Link2 size={16} /> {t('accounts.title')}</CardTitle>
        <CardDescription>{t('accounts.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PROVIDERS.map((p) => {
          const url = typeof window !== 'undefined' ? p.getUrl() : null;
          if (!url && !linked.has(p.id)) return null;
          const account = accounts?.find((a) => a.provider === p.id);
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg" style={{ border: '1px solid var(--theme-border)' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{p.name}</p>
                {account && (
                  <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{account.email || t('accounts.connected')}</p>
                )}
              </div>
              {account ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { if (confirm(`Disconnect ${p.name}?`)) unlinkMut.mutate(p.id); }}
                  disabled={unlinkMut.isPending}
                  className="flex items-center gap-1"
                >
                  <Unlink size={13} /> {t('accounts.disconnect')}
                </Button>
              ) : url ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    sessionStorage.setItem('oauth_link_mode', 'true');
                    window.location.href = url;
                  }}
                  className="flex items-center gap-1"
                >
                  <Link2 size={13} /> {t('accounts.connect')}
                </Button>
              ) : null}
            </div>
          );
        })}
        {unlinkMut.error && (
          <p className="text-xs" style={{ color: 'var(--theme-danger)' }}>
            {((unlinkMut.error as any)?.response?.data?.message) || t('accounts.disconnectFailed')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const t = useTranslations('settings');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [saved, setSaved] = useState(false);

  const setPasswordMut = useMutation({
    mutationFn: () =>
      apiClient.post('/users/me/password', {
        ...(hasPassword ? { currentPassword: currentPw } : {}),
        newPassword: newPw,
      }),
    onSuccess: () => {
      setCurrentPw('');
      setNewPw('');
      setSaved(true);
    },
  });

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [saved]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{hasPassword ? t('password.changeTitle') : t('password.setTitle')}</CardTitle>
        <CardDescription>
          {hasPassword ? t('password.changeSubtitle') : t('password.setSubtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {hasPassword && (
          <div>
            <Label htmlFor="current-password">{t('password.currentPassword')}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              className="mt-1"
            />
          </div>
        )}
        <div>
          <Label htmlFor="new-password">{t('password.newPassword')}</Label>
          <Input
            id="new-password"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder={t('password.placeholder')}
            className="mt-1"
          />
        </div>
        {setPasswordMut.error && (
          <p className="text-xs" style={{ color: 'var(--theme-danger)' }}>
            {((setPasswordMut.error as any)?.response?.data?.message) || t('password.failed')}
          </p>
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => setPasswordMut.mutate()}
            disabled={setPasswordMut.isPending || !newPw}
          >
            {setPasswordMut.isPending ? t('saving') : saved ? t('saved') : hasPassword ? t('password.changeButton') : t('password.setButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionCard() {
  const t = useTranslations('settings');
  const { data: billing } = useBillingStatus();
  const checkout = useBillingCheckout();
  const portal = useBillingPortal();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">{t('subscription.title')}</CardTitle>
        <CardDescription>{t('subscription.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
              {billing?.tier === 'PREMIUM' ? t('subscription.planPremium') : t('subscription.free')}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
              {billing?.tier === 'PREMIUM'
                ? billing.cancelAtPeriodEnd ? t('subscription.canceling') : t('subscription.active')
                : t('subscription.upgradePrompt')}
            </p>
          </div>
          {billing?.tier === 'PREMIUM' && billing.hasSubscription ? (
            <Button size="sm" variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
              {portal.isPending ? t('loading') : t('subscription.manage')}
            </Button>
          ) : billing?.tier !== 'PREMIUM' ? (
            <Button size="sm" onClick={() => checkout.mutate()} disabled={checkout.isPending}>
              {checkout.isPending ? t('loading') : t('subscription.upgrade')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}


function CalendarFeedCard() {
  const t = useTranslations('settings');
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['calendar', 'subscription'],
    queryFn: () =>
      apiClient.get('/calendar/subscription').then((r) => r.data as { url: string; webcalUrl: string }),
  });

  // Google fetches the feed server-side, so a host only resolvable on this
  // machine can never work there. Say so rather than let it fail silently.
  const host = data?.url ? new URL(data.url).hostname : '';
  const isLocalOnly = /^(localhost|127\.0\.0\.1|\[?::1\]?|.*\.local)$/i.test(host);

  const regenerate = useMutation({
    mutationFn: () => apiClient.post('/calendar/subscription/regenerate'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar', 'subscription'] }),
  });

  const copy = async () => {
    if (!data?.url) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the URL stays visible and selectable.
    }
  };

  // "Set up calendar subscription" on an event links to #calendar-feed. The
  // card renders after navigation, so the browser's own jump misses it.
  useEffect(() => {
    if (window.location.hash === '#calendar-feed') {
      document.getElementById('calendar-feed')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  return (
    <Card id="calendar-feed" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarPlus size={16} /> {t('calendarFeed.title')}
        </CardTitle>
        <CardDescription>
          {t('calendarFeed.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={data?.webcalUrl}>
                  <CalendarPlus size={14} className="mr-1.5" />
                  {t('calendarFeed.add')}
                </a>
              </Button>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? <Check size={14} className="mr-1.5" /> : <Copy size={14} className="mr-1.5" />}
                {copied ? t('calendarFeed.copied') : t('calendarFeed.copy')}
              </Button>
            </div>

            <Input readOnly value={data?.url ?? ''} onFocus={(e) => e.currentTarget.select()} />

            {isLocalOnly && (
              <div
                role="alert"
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: 'rgba(234,179,8,0.1)',
                  border: '1px solid rgba(234,179,8,0.3)',
                  color: '#eab308',
                }}
              >
                {t('calendarFeed.localOnly', { host })}
              </div>
            )}

            <div className="space-y-1.5 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              <p><strong>{t('calendarFeed.appleLabel')}</strong> {t('calendarFeed.appleText')}</p>
              <p>
                <strong>{t('calendarFeed.googleLabel')}</strong> {t('calendarFeed.googleBefore')}{' '}
                <a
                  href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {t('calendarFeed.googleLink')}
                </a>{' '}
                {t('calendarFeed.googleAfter')}
              </p>
              <p>
                {t('calendarFeed.refresh')}
              </p>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4">
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {t('calendarFeed.secret')}
              </p>
              <Button
                size="sm"
                variant="ghost"
                disabled={regenerate.isPending}
                onClick={() => {
                  if (window.confirm(t('calendarFeed.confirmReplace'))) {
                    regenerate.mutate();
                  }
                }}
              >
                <RefreshCw size={14} className="mr-1.5" />
                {t('calendarFeed.newLink')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SettingsPage() {
  const t = useTranslations('settings');
  const tc = useTranslations('common');
  const { user, logout } = useAuth();
  const { themes, setTheme, theme: currentTheme } = useTheme();
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  // "Explore" links to #interests when a member has picked none yet.
  const [tab, setTab] = useState('profile');
  useEffect(() => {
    if (window.location.hash === '#interests') setTab('interests');
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileName, setProfileName] = useState(user?.name ?? '');
  const [profileBio, setProfileBio] = useState('');
  const [profileAvatar, setProfileAvatar] = useState(user?.avatarUrl ?? '');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarPreviewRef = useRef<string | null>(null);
  const clearAvatarPreview = () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
    avatarPreviewRef.current = null;
    setAvatarPreview(null);
  };
  useEffect(() => () => {
    if (avatarPreviewRef.current) URL.revokeObjectURL(avatarPreviewRef.current);
  }, []);

  const { data: onboardingMode } = useQuery<{ onboardingMode: 'REQUIRED' | 'OPTIONAL' | 'DISABLED' }>({
    queryKey: ['onboarding-mode'],
    queryFn: () => apiClient.get('/platform/branding').then(r => r.data),
  });
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient.get('/users/me').then((r) => r.data),
  });

  const profileInitialized = useRef(false);
  useEffect(() => {
    if (!profile || profileInitialized.current) return;
    profileInitialized.current = true;
    setProfileName(profile.name ?? '');
    setProfileBio(profile.bio ?? '');
    setProfileAvatar(profile.avatarUrl ?? '');
  }, [profile]);


  const [savedProfile, setSavedProfile] = useState(false);
  const saveProfile = useMutation({
    mutationFn: () =>
      apiClient.patch('/users/me', {
        name: profileName || undefined,
        bio: profileBio || undefined,
      }).then((r) => r.data),
    onSuccess: (data) => {
      updateUser({ name: data.name, avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      setSavedProfile(true);
    },
  });

  useEffect(() => {
    if (!savedProfile) return;
    const timer = setTimeout(() => setSavedProfile(false), 2000);
    return () => clearTimeout(timer);
  }, [savedProfile]);

  const uploadAvatar = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post('/users/me/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: (data) => {
      clearAvatarPreview();
      setProfileAvatar(data.avatarUrl);
      updateUser({ avatarUrl: data.avatarUrl });
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: () => clearAvatarPreview(),
  });

  const exportData = useMutation({
    mutationFn: () => apiClient.get('/gdpr/export').then((r) => r.data),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => apiClient.delete('/gdpr/account'),
    onSuccess: () => logout(),
  });

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>
          {t('title')}
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('subtitle')}
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="w-full overflow-x-auto scrollbar-hide" role="region" aria-label={t('title')}>
          <TabsList className="w-max min-w-full flex-nowrap justify-start">
          <TabsTrigger value="profile" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <User size={14} /> {t('tabs.profile')}
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <Palette size={14} /> {t('tabs.appearance')}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <Bell size={14} /> {t('tabs.notifications')}
          </TabsTrigger>
          <TabsTrigger value="interests" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <Sparkles size={14} /> {t('tabs.interests')}
          </TabsTrigger>
          <TabsTrigger value="privacy" className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            <Shield size={14} /> {t('tabs.privacy')}
          </TabsTrigger>
          </TabsList>
        </div>

        {/* Profile tab */}
        <TabsContent value="profile" className="mt-6 space-y-4">
          {onboardingMode?.onboardingMode === 'OPTIONAL' && profile && !profile.onboardingCompleted && (
            <Card><CardContent className="pt-6"><Button variant="outline" onClick={() => window.dispatchEvent(new Event('square:resume-onboarding'))}>Resume onboarding</Button></CardContent></Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('profile.title')}</CardTitle>
              <CardDescription>{t('profile.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]"
                  aria-label={t('profile.changePhoto')}
                  disabled={uploadAvatar.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={avatarPreview || profileAvatar || user.avatarUrl || undefined} alt={user.name} />
                    <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
                  </Avatar>
                </button>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {user.name}
                  </p>
                  <p className="text-xs capitalize" style={{ color: 'var(--theme-text-muted)' }}>
                    {user.role}
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="sr-only"
                    aria-label={t('profile.changePhoto')}
                    onChange={async (e) => {
                      const picked = e.target.files?.[0];
                      e.target.value = '';
                      if (!picked) return;
                      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(picked.type)) {
                        toast.error(t('profile.photoUnreadable'), t('profile.unreadableHint'));
                        return;
                      }
                      let readable: File;
                      try {
                        readable = await readLocalFile(picked);
                      } catch {
                        toast.error(t('profile.photoUnreadable'), t('profile.unreadableHint'));
                        return;
                      }
                      const file = await shrinkAvatar(readable);
                      const tooLarge = avatarTooLargeMessage(file.size);
                      if (tooLarge) {
                        toast.error(t('profile.photoTooLarge'), t('profile.photoTooLargeText', { mb: (file.size / (1024 * 1024)).toFixed(1) }));
                        return;
                      }
                      clearAvatarPreview();
                      const previewUrl = URL.createObjectURL(file);
                      avatarPreviewRef.current = previewUrl;
                      setAvatarPreview(previewUrl);
                      uploadAvatar.mutate(file);
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-xs h-7"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatar.isPending}
                  >
                    {uploadAvatar.isPending ? (
                      <><Loader2 size={11} className="animate-spin mr-1" />{t('profile.uploading')}</>
                    ) : profileAvatar ? t('profile.changePhoto') : t('profile.addPhoto')}
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">{t('profile.fullName')}</Label>
                  <Input
                    id="name"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    disabled={profileLoading}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bio">{t('profile.bio')}</Label>
                  <Input
                    id="bio"
                    value={profileBio}
                    onChange={(e) => setProfileBio(e.target.value)}
                    disabled={profileLoading}
                    placeholder={profileLoading ? t('loading') : t('profile.bioPlaceholder')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="email">{t('profile.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue={user.email}
                    disabled
                    className="mt-1 opacity-60"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => saveProfile.mutate()}
                  disabled={saveProfile.isPending}
                >
                  {saveProfile.isPending ? t('saving') : savedProfile ? t('saved') : tc('save')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <ConnectedAccountsCard />

          <PasswordCard hasPassword={profile?.hasPassword ?? true} />

          <SubscriptionCard />

          <CalendarFeedCard />

          {/* Signing out is not dangerous; it used to sit in a red "danger zone". */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('profile.signOutTitle')}</CardTitle>
              <CardDescription>{t('profile.signOutSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" onClick={logout} className="flex items-center gap-2">
                <LogOut size={15} />
                {t('profile.signOut')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance tab */}
        <TabsContent value="appearance" className="mt-6 space-y-4">
          <LocaleSwitcher />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('appearance.title')}</CardTitle>
              <CardDescription>{t('appearance.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {themes.map((theme) => (
                  <button
                    key={theme.name}
                    onClick={() => setTheme(theme.name)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                    style={{
                      border: `2px solid ${theme.name === currentTheme.name ? theme.colors.primary : 'var(--theme-border)'}`,
                      background:
                        theme.name === currentTheme.name
                          ? `${theme.colors.primary}10`
                          : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex-shrink-0"
                      style={{ background: theme.colors.background, border: `2px solid ${theme.colors.primary}` }}
                    />
                    <div>
                      <p
                        className="text-sm font-medium"
                        style={{ color: 'var(--theme-text)' }}
                      >
                        {t(`appearance.themes.${theme.name}.name`)}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                        {t(`appearance.themes.${theme.name}.description`)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications tab */}
        <TabsContent value="notifications" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail size={16} /> {t('notifications.digestTitle')}
              </CardTitle>
              <CardDescription>
                {t('notifications.digestSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {DIGEST_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    apiClient.patch('/users/me/digest', { frequency: opt.value }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['me'] });
                    });
                  }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-left transition-all"
                  style={{
                    border: `2px solid ${profile?.emailDigest === opt.value ? 'var(--theme-primary)' : 'var(--theme-border)'}`,
                    background: profile?.emailDigest === opt.value ? 'rgba(197,168,128,0.06)' : 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: profile?.emailDigest === opt.value ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                  >
                    {profile?.emailDigest === opt.value && (
                      <div className="w-2 h-2 rounded-full" style={{ background: 'var(--theme-primary)' }} />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t(`notifications.${opt.key}`)}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{t(`notifications.${opt.key}Desc`)}</p>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays size={16} /> {t('notifications.calendarTitle')}
              </CardTitle>
              <CardDescription>
                {t('notifications.calendarSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {t('notifications.calendarToggle')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                    {t('notifications.calendarDesc')}
                  </p>
                </div>
                <Switch
                  checked={profile?.calendarInvites ?? true}
                  onCheckedChange={(checked) => {
                    apiClient.patch('/users/me/calendar-invites', { calendarInvites: checked }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['me'] });
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlarmClock size={16} /> {t('notifications.remindersTitle')}
              </CardTitle>
              <CardDescription>
                {t('notifications.remindersSubtitle')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                    {t('notifications.remindersToggle')}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                    {t('notifications.remindersDesc')}
                  </p>
                </div>
                <Switch
                  checked={profile?.eventReminders ?? true}
                  onCheckedChange={(checked) => {
                    apiClient.patch('/users/me/event-reminders', { eventReminders: checked }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['me'] });
                    });
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* An "In-App Notifications" card sat here with switches for push
              notifications and marketing emails. Neither was stored or acted
              on — they reset on reload — so it was removed rather than left
              promising something that does not exist. */}
        </TabsContent>

        {/* Interests tab */}
        <TabsContent value="interests" className="mt-6">
          <InterestPicker />
        </TabsContent>

        {/* Privacy tab */}
        <TabsContent value="privacy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('privacy.title')}</CardTitle>
              <CardDescription>{t('privacy.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className="p-4 rounded-lg text-sm leading-relaxed"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--theme-border)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <p className="font-medium mb-1" style={{ color: 'var(--theme-text)' }}>
                  {t('privacy.gdprTitle')}
                </p>
                <p>
                  {t('privacy.gdprDescription')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportData.mutate()}
                  disabled={exportData.isPending}
                  className="flex items-center gap-2"
                >
                  {exportData.isPending ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                  {t('privacy.exportData')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  style={{ borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}
                  disabled={deleteAccount.isPending}
                  onClick={() => {
                    if (confirm(t('privacy.deleteConfirmation'))) {
                      deleteAccount.mutate();
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  {deleteAccount.isPending ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  {t('privacy.deleteAccount')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
