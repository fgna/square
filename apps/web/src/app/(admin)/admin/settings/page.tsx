'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';
import { editableSettings, type PlatformSettings } from '@/lib/platform-settings';
import { ImageUploadField } from '@/components/common/image-upload-field';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save } from 'lucide-react';

function ColorSwatch({ color }: { color: string }) {
  const isValid = /^#[0-9a-fA-F]{6}$/.test(color);
  return (
    <div
      className="w-8 h-8 rounded-lg border flex-shrink-0"
      style={{
        background: isValid ? color : 'var(--theme-border)',
        borderColor: 'var(--theme-border)',
      }}
    />
  );
}

export default function PlatformSettingsPage() {
  const t = useTranslations('adminSettingsUI');
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<PlatformSettings>({
    queryKey: ['admin', 'platform-settings'],
    queryFn: () => apiClient.get('/admin/settings').then(r => r.data),
  });

  const [form, setForm] = useState<Partial<PlatformSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: () => apiClient.put('/admin/settings', editableSettings(form)).then(r => r.data),
    onSuccess: () => {
      toast.success('Settings saved');
      qc.invalidateQueries({ queryKey: ['admin', 'platform-settings'] });
      qc.invalidateQueries({ queryKey: ['branding'] });
    },
  });

  const set = (key: keyof PlatformSettings, value: string | boolean) =>
    setForm(f => ({ ...f, [key]: value }));

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('branding')}</CardTitle>
          <CardDescription>{t('brandingDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="platformName">{t('platformName')}</Label>
            <Input
              id="platformName"
              value={form.platformName ?? ''}
              onChange={e => set('platformName', e.target.value)}
              className="mt-1"
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('logo')}</Label>
            <ImageUploadField
              label={t('logo')}
              value={form.logoUrl}
              onChange={url => setForm(f => ({ ...f, logoUrl: url }))}
              previewClassName="h-16 w-48"
            />
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t('logoHint')}
            </p>
          </div>

          <div>
            <Label htmlFor="primaryColor">{t('primaryColor')}</Label>
            <div className="flex items-center gap-3 mt-1">
              <ColorSwatch color={form.primaryColor ?? ''} />
              <Input
                id="primaryColor"
                value={form.primaryColor ?? ''}
                onChange={e => set('primaryColor', e.target.value)}
                placeholder="#c5a880"
                className="font-mono"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="accentColor">{t('accentColor')}</Label>
            <div className="flex items-center gap-3 mt-1">
              <ColorSwatch color={form.accentColor ?? ''} />
              <Input
                id="accentColor"
                value={form.accentColor ?? ''}
                onChange={e => set('accentColor', e.target.value)}
                placeholder="#6366f1"
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('access')}</CardTitle>
          <CardDescription>{t('accessDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{t('publicSignup')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                {t('publicSignupDescription')}
              </p>
            </div>
            <Switch
              checked={form.allowSignups ?? true}
              onCheckedChange={v => set('allowSignups', v)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Welcome video</CardTitle>
          <CardDescription>
            New members see it in the first onboarding step, and on their dashboard until they hide it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            aria-label="Welcome video link"
            placeholder="https://www.loom.com/share/… · https://vimeo.com/… · https://youtu.be/…"
            value={form.welcomeVideoUrl ?? ''}
            onChange={e => set('welcomeVideoUrl', e.target.value)}
          />
          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
            Paste a Loom, Vimeo or YouTube share link. Leave empty for no welcome video.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex items-center gap-2">
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
