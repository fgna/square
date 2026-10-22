'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Plus, Trash2, X, Calendar } from 'lucide-react';
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from '@/hooks/use-goals';
import type { Goal, CreateGoalInput } from '@/hooks/use-goals';

const MAX_GOALS = 5;

function statusBadgeStyle(status: Goal['status']) {
  switch (status) {
    case 'COMPLETED':
      return {
        background: 'rgba(34,197,94,0.15)',
        borderColor: 'rgba(34,197,94,0.3)',
        color: '#22c55e',
      };
    case 'PAUSED':
      return {
        background: 'rgba(234,179,8,0.15)',
        borderColor: 'rgba(234,179,8,0.3)',
        color: '#eab308',
      };
    default:
      return undefined;
  }
}

function GoalItem({ goal }: { goal: Goal }) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const updateMutation = useUpdateGoal();
  const deleteMutation = useDeleteGoal();
  const [editingProgress, setEditingProgress] = useState(false);
  const [progressValue, setProgressValue] = useState(goal.progress);

  const handleProgressSave = () => {
    const clamped = Math.max(0, Math.min(100, progressValue));
    updateMutation.mutate(
      { id: goal.id, progress: clamped },
      { onSuccess: () => setEditingProgress(false) },
    );
  };

  const handleStatusToggle = () => {
    const nextStatus = goal.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    updateMutation.mutate({ id: goal.id, status: nextStatus });
  };

  const formattedDate = goal.targetDate
    ? new Date(goal.targetDate).toLocaleDateString(locale === 'de' ? 'de-DE' : 'en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--theme-border, rgba(255,255,255,0.08))',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button
              onClick={handleStatusToggle}
              disabled={updateMutation.isPending}
              className="text-sm font-medium truncate text-left"
              style={{
                color: goal.status === 'COMPLETED' ? 'var(--theme-text-muted)' : 'var(--theme-text)',
                textDecoration: goal.status === 'COMPLETED' ? 'line-through' : 'none',
              }}
              title={goal.status === 'ACTIVE' ? t('goals.markCompleted') : t('goals.markActive')}
            >
              {goal.title}
            </button>
            <Badge style={statusBadgeStyle(goal.status)}>{t(`goals.status.${goal.status}`)}</Badge>
          </div>
          {goal.description && (
            <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
              {goal.description}
            </p>
          )}
        </div>
        <button
          onClick={() => deleteMutation.mutate(goal.id)}
          disabled={deleteMutation.isPending}
          className="p-1 rounded-md transition-colors hover:bg-white/5 shrink-0"
          style={{ color: 'var(--theme-text-muted)' }}
          aria-label={t('goals.delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {editingProgress ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                value={progressValue}
                onChange={(e) => setProgressValue(Number(e.target.value))}
                className="h-6 w-16 text-xs px-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleProgressSave();
                  if (e.key === 'Escape') setEditingProgress(false);
                }}
              />
              <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>%</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1 text-xs"
                onClick={handleProgressSave}
                disabled={updateMutation.isPending}
              >
                {t('goals.save')}
              </Button>
              <button
                onClick={() => {
                  setProgressValue(goal.progress);
                  setEditingProgress(false);
                }}
                className="p-0.5"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setProgressValue(goal.progress);
                setEditingProgress(true);
              }}
              className="text-xs font-medium hover:underline"
              style={{ color: 'var(--theme-primary)' }}
            >
              {goal.progress}%
            </button>
          )}
          {formattedDate && (
            <span
              className="text-[10px] flex items-center gap-1"
              style={{ color: 'var(--theme-text-muted)' }}
            >
              <Calendar size={10} />
              {formattedDate}
            </span>
          )}
        </div>
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${goal.progress}%`,
              background:
                goal.progress >= 100
                  ? '#22c55e'
                  : 'var(--theme-primary, #c5a880)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function AddGoalForm({ onClose }: { onClose: () => void }) {
  const t = useTranslations('dashboard');
  const createMutation = useCreateGoal();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) return;
    const input: CreateGoalInput = {
      title: title.trim(),
      description: description.trim() || undefined,
      targetDate: targetDate || undefined,
    };
    createMutation.mutate(input, {
      onSuccess: () => onClose(),
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label
          className="text-xs font-medium mb-1 block"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {t('goals.fieldTitle')}
        </label>
        <Input
          placeholder={t('goals.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
          }}
        />
      </div>
      <div>
        <label
          className="text-xs font-medium mb-1 block"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {t('goals.description')}
        </label>
        <Input
          placeholder={t('goals.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label
          className="text-xs font-medium mb-1 block"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {t('goals.targetDate')}
        </label>
        <Input
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={!title.trim() || createMutation.isPending}
        >
          {createMutation.isPending ? t('goals.adding') : t('goals.addButton')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          <X size={14} className="mr-1" />
          {t('cancel')}
        </Button>
      </div>
    </div>
  );
}

export function MyGoals() {
  const t = useTranslations('dashboard');
  const { data: goals, isLoading, isError } = useGoals();
  const [isAdding, setIsAdding] = useState(false);

  const canAdd = (goals?.length ?? 0) < MAX_GOALS;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target size={16} style={{ color: 'var(--theme-primary)' }} />
            {t('goals.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
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
            {t('goals.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm" style={{ color: 'var(--theme-danger, #ef4444)' }}>
            Failed to load goals.{' '}
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
            {t('goals.title')}
          </span>
          {!isAdding && canAdd && goals && goals.length > 0 && (
            <button
              onClick={() => setIsAdding(true)}
              className="p-1 rounded-md transition-colors hover:bg-white/5"
              style={{ color: 'var(--theme-text-muted)' }}
              aria-label={t('goals.add')}
            >
              <Plus size={14} />
            </button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAdding ? (
          <AddGoalForm onClose={() => setIsAdding(false)} />
        ) : goals && goals.length > 0 ? (
          <div className="space-y-3">
            {goals.map((goal) => (
              <GoalItem key={goal.id} goal={goal} />
            ))}
            {!canAdd && (
              <p
                className="text-[10px] text-center pt-1"
                style={{ color: 'var(--theme-text-muted)' }}
              >
                {t('goals.max', { max: MAX_GOALS })}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm mb-3" style={{ color: 'var(--theme-text-muted)' }}>
              {t('goals.empty', { max: MAX_GOALS })}
            </p>
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus size={14} className="mr-1" />
              {t('goals.first')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
