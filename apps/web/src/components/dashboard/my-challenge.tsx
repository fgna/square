'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Pencil, CheckCircle2, Archive, X } from 'lucide-react';
import { useChallenge, useUpsertChallenge } from '@/hooks/use-challenge';
import type { UpsertChallengeInput } from '@/hooks/use-challenge';

export function MyChallenge() {
  const t = useTranslations('dashboard');
  const { data: challenge, isLoading, isError } = useChallenge();
  const upsertMutation = useUpsertChallenge();
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [reflection, setReflection] = useState('');

  const openEditor = () => {
    setTitle(challenge?.title ?? '');
    setDescription(challenge?.description ?? '');
    setReflection(challenge?.reflection ?? '');
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!title.trim()) return;
    const input: UpsertChallengeInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      reflection: reflection.trim() || undefined,
    };
    if (challenge) {
      input.status = challenge.status;
    }
    upsertMutation.mutate(input, {
      onSuccess: () => setIsEditing(false),
    });
  };

  const handleStatusChange = (status: 'COMPLETED' | 'ARCHIVED') => {
    if (!challenge) return;
    upsertMutation.mutate({
      title: challenge.title,
      description: challenge.description ?? undefined,
      reflection: challenge.reflection ?? undefined,
      status,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target size={16} style={{ color: 'var(--theme-primary)' }} />
            {t('challenge.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target size={16} style={{ color: 'var(--theme-primary)' }} />
            {t('challenge.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm" style={{ color: 'var(--theme-danger, #ef4444)' }}>
            Failed to load challenge.{' '}
            <button className="underline" onClick={() => window.location.reload()}>
              {t('retry')}
            </button>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target size={16} style={{ color: 'var(--theme-primary)' }} />
            {t('challenge.title')}
          </span>
          {challenge && !isEditing && (
            <button
              onClick={openEditor}
              className="p-1 rounded-md transition-colors hover:bg-white/5"
              style={{ color: 'var(--theme-text-muted)' }}
              aria-label={t('challenge.edit')}
            >
              <Pencil size={14} />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label
                className="text-xs font-medium mb-1 block"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {t('challenge.fieldTitle')}
              </label>
              <Input
                placeholder={t('challenge.titlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label
                className="text-xs font-medium mb-1 block"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {t('challenge.description')}
              </label>
              <Textarea
                placeholder={t('challenge.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div>
              <label
                className="text-xs font-medium mb-1 block"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {t('challenge.reflection')}
              </label>
              <Textarea
                placeholder={t('challenge.reflectionPlaceholder')}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!title.trim() || upsertMutation.isPending}
              >
                {upsertMutation.isPending ? t('challenge.saving') : t('challenge.save')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={upsertMutation.isPending}
              >
                <X size={14} className="mr-1" />
                {t('cancel')}
              </Button>
            </div>
          </div>
        ) : challenge ? (
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>
                  {challenge.title}
                </p>
                <Badge
                  style={
                    challenge.status === 'COMPLETED'
                      ? {
                          background: 'rgba(34,197,94,0.15)',
                          borderColor: 'rgba(34,197,94,0.3)',
                          color: '#22c55e',
                        }
                      : challenge.status === 'ARCHIVED'
                        ? {
                            background: 'rgba(156,163,175,0.15)',
                            borderColor: 'rgba(156,163,175,0.3)',
                            color: '#9ca3af',
                          }
                        : undefined
                  }
                >
                  {t(`challenge.status.${challenge.status}`)}
                </Badge>
              </div>
              {challenge.description && (
                <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                  {challenge.description}
                </p>
              )}
            </div>
            {challenge.reflection && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  background: 'rgba(197,168,128,0.06)',
                  border: '1px solid rgba(197,168,128,0.15)',
                  color: 'var(--theme-text-muted)',
                }}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  {t('challenge.reflectionHeading')}
                </p>
                {challenge.reflection}
              </div>
            )}
            {challenge.status === 'ACTIVE' && (
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStatusChange('COMPLETED')}
                  disabled={upsertMutation.isPending}
                >
                  <CheckCircle2 size={14} className="mr-1" />
                  {t('challenge.complete')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleStatusChange('ARCHIVED')}
                  disabled={upsertMutation.isPending}
                >
                  <Archive size={14} className="mr-1" />
                  {t('challenge.archive')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm mb-3" style={{ color: 'var(--theme-text-muted)' }}>
              {t('challenge.empty')}
            </p>
            <Button size="sm" onClick={openEditor}>
              <Target size={14} className="mr-1" />
              {t('challenge.set')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
