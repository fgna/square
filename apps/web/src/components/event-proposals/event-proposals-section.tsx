'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useFormatters } from '@/lib/use-formatters';
import { Loader2, Plus, X, Calendar, ThumbsUp, Lock, Trash2, ChevronDown, ChevronUp, Vote, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import {
  useEventProposals,
  useCreateProposal,
  useUpdateProposal,
  useVoteProposal,
  useRemoveVote,
  useCloseProposal,
  useDeleteProposal,
} from '@/hooks/use-event-proposals';
import { formatProposedDate, joinProposedDate, splitProposedDate } from '@/lib/proposal-dates';

interface EventProposalsSectionProps {
  compact?: boolean;
}

export function EventProposalsSection({ compact = false }: EventProposalsSectionProps) {
  const t = useTranslations('events');
  const { formatDate, locale } = useFormatters();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { data, isLoading } = useEventProposals();
  const createMutation = useCreateProposal();
  const updateMutation = useUpdateProposal();
  const voteMutation = useVoteProposal();
  const removeMutation = useRemoveVote();
  const closeMutation = useCloseProposal();
  const deleteMutation = useDeleteProposal();

  const [expanded, setExpanded] = useState(!compact);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Each row: start (datetime-local) and an optional end time on the same day.
  const [dates, setDates] = useState<{ start: string; end: string }[]>([{ start: '', end: '' }, { start: '', end: '' }]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const addDate = () => setDates((d) => [...d, { start: '', end: '' }]);
  const removeDate = (i: number) => setDates((d) => d.filter((_, idx) => idx !== i));
  const updateDate = (i: number, val: Partial<{ start: string; end: string }>) =>
    setDates((d) => d.map((v, idx) => (idx === i ? { ...v, ...val } : v)));

  const startEdit = (proposal: any) => {
    setEditingId(proposal.id);
    setTitle(proposal.title);
    setDescription(proposal.description ?? '');
    setDates(
      ((proposal.proposedDates as string[]) || []).map((value) => {
        const { start, end } = splitProposedDate(value);
        return { start: start.slice(0, 16), end: end ? end.slice(11, 16) : '' };
      }),
    );
    setShowForm(true);
    setExpanded(true);
  };

  const resetForm = () => {
    setFormError(null);
    setTitle('');
    setDescription('');
    setDates([{ start: '', end: '' }, { start: '', end: '' }]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = async () => {
    setFormError(null);
    const validDates = dates.map((d) => joinProposedDate(d.start, d.end)).filter(Boolean);
    if (dates.some((d) => d.start && d.end && d.end <= d.start.slice(11, 16))) {
      setFormError(t('proposals.errorEnd'));
      return;
    }
    // CreateProposalDto requires at least 3 characters.
    if (title.trim().length < 3) {
      setFormError(t('proposals.errorTitle'));
      return;
    }
    // Voting only makes sense with something to choose between.
    if (validDates.length < 2) {
      setFormError(t('proposals.errorDates'));
      return;
    }
    try {
      const payload = { title: title.trim(), description: description.trim() || undefined, proposedDates: validDates };
      if (editingId) await updateMutation.mutateAsync({ id: editingId, ...payload });
      else await createMutation.mutateAsync(payload);
      resetForm();
    } catch (err: any) {
      const message = err?.response?.data?.message;
      setFormError(
        Array.isArray(message)
          ? message.join(' · ')
          : message || t('proposals.errorGeneric'),
      );
    }
  };

  const handleToggleVote = async (proposalId: string, hasVoted: boolean) => {
    if (hasVoted) {
      await removeMutation.mutateAsync(proposalId);
    } else {
      await voteMutation.mutateAsync({ id: proposalId });
    }
  };

  const handleDateVote = async (proposalId: string, date: string, currentVotes: string[]) => {
    const newVotes = currentVotes.includes(date)
      ? currentVotes.filter((d) => d !== date)
      : [...currentVotes, date];
    await voteMutation.mutateAsync({ id: proposalId, dateVotes: newVotes });
  };

  const proposals = data?.data || [];
  const openProposals = proposals.filter((p: any) => p.status === 'OPEN');

  if (isLoading) {
    return (
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>Loading proposals…</span>
      </div>
    );
  }

  if (proposals.length === 0 && !isAdmin) return null;

  const displayProposals = compact ? openProposals : proposals;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Vote size={15} style={{ color: 'var(--theme-primary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
            {t('proposals.title')}
          </span>
          {openProposals.length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(197,168,128,0.12)', color: 'var(--theme-primary)' }}
            >
              {t('proposals.open', { count: openProposals.length })}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={14} style={{ color: 'var(--theme-text-muted)' }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--theme-text-muted)' }} />
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-4 space-y-3" style={{ borderTop: '1px solid var(--theme-border)' }}>
          {/* Admin: new proposal button + form */}
          {isAdmin && (
            <div className="pt-3">
              {!showForm ? (
                <Button onClick={() => setShowForm(true)} size="sm" variant="outline" className="w-full">
                  <Plus size={13} className="mr-1" /> {t('proposals.new')}
                </Button>
              ) : (
                <div className="space-y-3 rounded-lg p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--theme-border)' }}>
                  <Input placeholder={t('proposals.titlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} />
                  <Textarea placeholder={t('proposals.descriptionPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                  {formError && (
                    <div
                      role="alert"
                      className="rounded-lg px-3 py-2 text-xs"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        color: 'var(--theme-danger, #ef4444)',
                      }}
                    >
                      {formError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('proposals.dates')} <span style={{ opacity: 0.7 }}>{t('proposals.datesHint')}</span>
                    </p>
                    {dates.map((d, i) => (
                      <div key={i} className="flex gap-2">
                        <Input type="datetime-local" value={d.start} onChange={(e) => updateDate(i, { start: e.target.value })} className="flex-1" aria-label={t('proposals.start')} />
                        <Input type="time" value={d.end} onChange={(e) => updateDate(i, { end: e.target.value })} className="w-28" aria-label={t('proposals.endTime')} />
                        {dates.length > 2 && (
                          <button type="button" onClick={() => removeDate(i)} className="p-2 hover:bg-white/5 rounded-md">
                            <X size={14} style={{ color: 'var(--theme-text-muted)' }} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button type="button" onClick={addDate} className="text-xs flex items-center gap-1 px-2 py-1 hover:bg-white/5 rounded" style={{ color: 'var(--theme-primary)' }}>
                      <Plus size={12} /> {t('proposals.addDate')}
                    </button>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={resetForm}>{t('proposals.cancel')}</Button>
                    <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending || updateMutation.isPending}>
                      {createMutation.isPending || updateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : editingId ? t('proposals.save') : t('proposals.create')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Proposals list */}
          {displayProposals.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {compact ? t('proposals.noneOpen') : t('proposals.none')}
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {displayProposals.map((proposal: any) => {
                const proposedDates = (proposal.proposedDates as string[]) || [];
                const myDateVotes = (proposal.myDateVotes as string[]) || [];
                const isClosed = proposal.status === 'CLOSED';

                return (
                  <div
                    key={proposal.id}
                    className="rounded-lg p-4 space-y-3"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--theme-border)',
                      opacity: isClosed ? 0.7 : 1,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--theme-text)' }}>
                            {proposal.title}
                          </h4>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                            style={{
                              background: isClosed ? 'rgba(255,255,255,0.05)' : 'rgba(197,168,128,0.12)',
                              color: isClosed ? 'var(--theme-text-muted)' : 'var(--theme-primary)',
                            }}
                          >
                            {t(`proposals.status.${proposal.status}`)}
                          </span>
                        </div>
                        {proposal.description && (
                          <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--theme-text-muted)' }}>
                            {proposal.description}
                          </p>
                        )}
                      </div>
                      {!isClosed && (
                        <Button
                          variant={proposal.hasVoted ? 'default' : 'outline'}
                          size="sm"
                          className="ml-2 flex-shrink-0"
                          onClick={() => handleToggleVote(proposal.id, proposal.hasVoted)}
                          disabled={voteMutation.isPending || removeMutation.isPending}
                        >
                          <ThumbsUp size={11} className="mr-1" />
                          {proposal._count?.votes || 0}
                        </Button>
                      )}
                    </div>

                    {/* Date options */}
                    <div className="flex flex-wrap gap-1.5">
                      {proposedDates.map((date: string) => {
                        const isVoted = myDateVotes.includes(date);
                        const formatted = formatProposedDate(date, locale);
                        return (
                          <button
                            key={date}
                            type="button"
                            disabled={isClosed}
                            onClick={() => handleDateVote(proposal.id, date, myDateVotes)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                            style={{
                              background: isVoted ? 'rgba(197,168,128,0.15)' : 'rgba(255,255,255,0.03)',
                              color: isVoted ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                              border: isVoted ? '1px solid rgba(197,168,128,0.3)' : '1px solid var(--theme-border)',
                            }}
                          >
                            <Calendar size={9} className="inline mr-1" />
                            {formatted}
                          </button>
                        );
                      })}
                    </div>

                    {/* Admin actions */}
                    {isAdmin && (
                      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid var(--theme-border)' }}>
                        {!isClosed && (
                          <Button variant="ghost" size="sm" onClick={() => startEdit(proposal)}>
                            <Pencil size={11} className="mr-1" /> {t('proposals.edit')}
                          </Button>
                        )}
                        {!isClosed && (
                          <Button variant="ghost" size="sm" onClick={() => closeMutation.mutate(proposal.id)} disabled={closeMutation.isPending}>
                            <Lock size={11} className="mr-1" /> {t('proposals.close')}
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(proposal.id)} disabled={deleteMutation.isPending} className="text-red-400 hover:text-red-300">
                          <Trash2 size={11} className="mr-1" /> {t('proposals.delete')}
                        </Button>
                      </div>
                    )}

                    <p className="text-[10px]" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('proposals.by', { name: proposal.createdBy?.name ?? '', date: formatDate(proposal.createdAt) })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
