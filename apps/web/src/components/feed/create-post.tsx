'use client';

import { useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, BarChart3, Plus, X, Type, PenLine, HelpCircle, Megaphone, Hand, MessageSquare, Tag, Trophy, MoreHorizontal, AlertCircle, Lightbulb } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useCreatePost } from '@/hooks/use-feed';
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { getInitials } from '@community/shared';
import { RichTextEditor } from './rich-text-editor';
import { chipStyle } from '@/lib/chip-style';
import { PostAttachmentsPicker, type PendingAttachment } from './post-attachments-picker';

type PostType = 'DISCUSSION' | 'QUESTION' | 'ANNOUNCEMENT' | 'INTRODUCTION' | 'SUCCESS_STORY' | 'TOPIC_SUGGESTION';

// CreatePollDto requires at least 3 characters.
const POLL_QUESTION_MIN = 3;

type PostTypeLabel = 'discussion' | 'question' | 'announcement' | 'introduction' | 'successStory' | 'topicSuggestion';
const POST_TYPES: { value: PostType; label: PostTypeLabel; icon: React.ElementType }[] = [
  { value: 'DISCUSSION', label: 'discussion', icon: MessageSquare },
  { value: 'QUESTION', label: 'question', icon: HelpCircle },
  { value: 'ANNOUNCEMENT', label: 'announcement', icon: Megaphone },
  { value: 'INTRODUCTION', label: 'introduction', icon: Hand },
  { value: 'SUCCESS_STORY', label: 'successStory', icon: Trophy },
  { value: 'TOPIC_SUGGESTION', label: 'topicSuggestion', icon: Lightbulb },
];

interface PollDraft {
  question: string;
  options: string[];
}

type EditorMode = 'plain' | 'rich';

interface CreatePostProps {
  initialType?: PostType;
  initialFocused?: boolean;
}

export function CreatePost({ initialType, initialFocused }: CreatePostProps = {}) {
  const [content, setContent] = useState('');
  const [richContent, setRichContent] = useState('');
  const [focused, setFocused] = useState(initialFocused ?? false);
  const [editorMode, setEditorMode] = useState<EditorMode>('rich');
  const [postType, setPostType] = useState<PostType>(initialType ?? 'DISCUSSION');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showCategories, setShowCategories] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showMobileMore, setShowMobileMore] = useState(false);
  const [mobileFormat, setMobileFormat] = useState(false);
  const [poll, setPoll] = useState<PollDraft>({ question: '', options: ['', ''] });
  // Keep the desktop rich editor. Mobile defaults to the simpler plain-text composer.
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setEditorMode('plain');
  }, []);
  const t = useTranslations('feed');
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const queryClient = useQueryClient();
  const createPost = useCreatePost();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/categories').then((r) => r.data),
    staleTime: 60_000,
  });

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const resetForm = () => {
    setSubmitError(null);
    setContent('');
    setRichContent('');
    setFocused(false);
    // In a forum tab the next post is again of that tab's kind.
    setPostType(initialType ?? 'DISCUSSION');
    setSelectedCategories([]);
    setShowCategories(false);
    setShowPoll(false);
    setShowMobileMore(false);
    setMobileFormat(false);
    setAttachments([]);
    setEditorMode(window.matchMedia('(max-width: 767px)').matches ? 'plain' : 'rich');
    setPoll({ question: '', options: ['', ''] });
  };

  const getSubmitContent = () => {
    if (editorMode === 'rich') {
      const stripped = richContent.replace(/<[^>]*>/g, '').trim();
      return stripped ? richContent : '';
    }
    return content.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const submitContent = getSubmitContent();
    if (!submitContent) {
      setSubmitError(t('emptyPost'));
      return;
    }

    // An open poll that is not yet valid would otherwise be dropped in silence:
    // the post goes out without it and nobody says why.
    if (showPoll) {
      const question = poll.question.trim();
      const options = poll.options.filter((o) => o.trim());
      if (question.length < POLL_QUESTION_MIN) {
        setSubmitError(t('pollQuestionTooShort', { min: POLL_QUESTION_MIN }));
        return;
      }
      if (options.length < 2) {
        setSubmitError(t('pollNeedsOptions'));
        return;
      }
    }

    const pollPayload =
      showPoll && poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2
        ? {
            question: poll.question.trim(),
            options: poll.options.filter((o) => o.trim()),
          }
        : undefined;

    try {
      const created = await createPost.mutateAsync({
        content: submitContent,
        type: postType,
        categoryIds: selectedCategories.length ? selectedCategories : undefined,
        poll: pollPayload,
      });
      // Attachments (admins only) are linked once the post exists.
      for (const a of attachments) {
        await apiClient.post(`/posts/${created.id}/attachments`, { uploadId: a.uploadId, videoUrl: a.videoUrl });
      }
      if (attachments.length) queryClient.invalidateQueries({ queryKey: ['feed'] });
      resetForm();
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      setSubmitError(
        Array.isArray(serverMessage)
          ? serverMessage.join(' · ')
          : serverMessage || err?.message || t('postFailed'),
      );
    }
  };

  const handleRichChange = useCallback((html: string) => {
    setRichContent(html);
  }, []);

  const addPollOption = () => {
    if (poll.options.length < 10) {
      setPoll((p) => ({ ...p, options: [...p.options, ''] }));
    }
  };

  const removePollOption = (index: number) => {
    if (poll.options.length > 2) {
      setPoll((p) => ({ ...p, options: p.options.filter((_, i) => i !== index) }));
    }
  };

  const updateOption = (index: number, value: string) => {
    setPoll((p) => {
      const options = [...p.options];
      options[index] = value;
      return { ...p, options };
    });
  };

  const hasContent = editorMode === 'rich'
    ? richContent.replace(/<[^>]*>/g, '').trim().length > 0
    : content.trim().length > 0;

  // The composer used to look exactly like a post card and hid its tools
  // (poll, post type) until it was clicked — members took it for a post and
  // never found the poll. It now carries a heading, an accent border, and
  // shortcuts that are visible before anything is typed.
  const startWith = (type: PostType, poll = false) => {
    setPostType(type);
    if (poll) setShowPoll(true);
    setFocused(true);
  };

  return (
    <section
      aria-label={t('createPost')}
      className="rounded-xl p-3 md:p-4 min-w-0 space-y-3"
      style={{
        background: 'linear-gradient(0deg, rgba(197,168,128,0.05), rgba(197,168,128,0.05)), var(--theme-card)',
        border: '1px solid rgba(197,168,128,0.35)',
      }}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: 'var(--theme-primary)' }}>
        <PenLine size={15} /> {t('createPost')}
      </h2>
      <div className="flex gap-2 md:gap-3 min-w-0">
        <Avatar className="h-8 w-8 md:h-9 md:w-9 flex-shrink-0">
          <AvatarImage src={user?.avatarUrl || undefined} />
          <AvatarFallback className="text-xs">{getInitials(user?.name || 'U')}</AvatarFallback>
        </Avatar>
        <form onSubmit={handleSubmit} className="min-w-0 flex-1 space-y-3">
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: 'var(--theme-danger, #ef4444)',
              }}
            >
              <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          {editorMode === 'rich' ? (
            <div onClick={() => setFocused(true)}>
              <RichTextEditor
                content={richContent}
                onChange={handleRichChange}
                placeholder={t('placeholder')}
                compact={!focused}
              />
            </div>
          ) : (
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => setFocused(true)}
              placeholder={t('placeholder')}
              rows={focused ? 4 : 1}
              className="w-full min-w-0 resize-y transition-all duration-200"
            />
          )}

          {focused && isAdmin && <PostAttachmentsPicker value={attachments} onChange={setAttachments} />}
          {focused && showPoll && (
            <div
              className="rounded-lg p-3 space-y-2"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--theme-border)' }}
            >
              <Input
                placeholder={t('pollQuestion')}
                value={poll.question}
                onChange={(e) => setPoll((p) => ({ ...p, question: e.target.value }))}
              />
              {poll.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={t('option', { number: i + 1 })}
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    className="flex-1"
                  />
                  {poll.options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(i)}
                      className="p-2 rounded-md hover:bg-white/5"
                      style={{ color: 'var(--theme-text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {poll.options.length < 10 && (
                <button
                  type="button"
                  onClick={addPollOption}
                  className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--theme-primary)' }}
                >
                  <Plus size={12} />
                  {t('addOption')}
                </button>
              )}
            </div>
          )}

          {!focused && (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['DISCUSSION', 'writePost', MessageSquare, false],
                  ['QUESTION', 'askQuestion', HelpCircle, false],
                  ['SUCCESS_STORY', 'shareSuccess', Trophy, false],
                  ['DISCUSSION', 'createPoll', BarChart3, true],
                ] as const
              ).map(([type, label, Icon, poll]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => startWith(type, poll)}
                  className="flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-full transition-colors hover:bg-white/5"
                  style={{ color: 'var(--theme-text)', border: '1px solid var(--theme-border)' }}
                >
                  <Icon size={13} style={{ color: 'var(--theme-primary)' }} />
                  {t(label)}
                </button>
              ))}
            </div>
          )}

          {focused && (
            <>
            {/* Category tags */}
            {showCategories && categories?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors"
                    style={chipStyle(selectedCategories.includes(cat.id))}
                  >
                    {cat.icon && <span>{cat.icon}</span>}
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Mobile: compact, wrapping controls. Desktop retains the full toolbar. */}
            <div className="space-y-2 md:hidden">
              <div className="flex flex-wrap items-center gap-1.5">
                {POST_TYPES.filter(({ value }) => value === 'DISCUSSION' || value === 'QUESTION').map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPostType(value)}
                    aria-pressed={postType === value}
                    className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
                    style={{
                      color: postType === value ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                      background: postType === value ? 'rgba(197,168,128,0.12)' : 'transparent',
                    }}
                  >
                    <Icon size={13} />{label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowMobileMore((v) => !v)}
                  aria-expanded={showMobileMore}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  <MoreHorizontal size={15} />{t('more')}
                </button>
              </div>
              {showMobileMore && (
                <div className="flex flex-wrap gap-1.5 rounded-lg p-2" style={{ border: '1px solid var(--theme-border)' }}>
                  {POST_TYPES.filter(({ value }) => value !== 'DISCUSSION' && value !== 'QUESTION' && (value !== 'ANNOUNCEMENT' || user?.role === 'ADMIN')).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => { setPostType(value); setShowMobileMore(false); }}
                      aria-pressed={postType === value}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs"
                      style={{ color: postType === value ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                    >
                      <Icon size={13} />{t(label)}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowPoll((v) => !v)} aria-pressed={showPoll}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{ color: showPoll ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}>
                    <BarChart3 size={13} />{t('createPoll')}
                  </button>
                  <button type="button" onClick={() => setShowCategories((v) => !v)} aria-pressed={showCategories}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs" style={{ color: showCategories ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}>
                    <Tag size={13} />{t('tags')}{selectedCategories.length ? ` (${selectedCategories.length})` : ''}
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" onClick={() => {
                    // Do not silently discard text when switching editor formats.
                    if (mobileFormat) {
                      setContent(richContent.replace(/<[^>]*>/g, ' ').trim());
                      setEditorMode('plain');
                    } else {
                      setRichContent(content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
                      setEditorMode('rich');
                    }
                    setMobileFormat((v) => !v);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs"
                  style={{ color: 'var(--theme-text-muted)' }}>
                  <Type size={14} />{mobileFormat ? t('plainText') : t('format')}
                </button>
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={resetForm}>{t('cancel')}</Button>
                  <Button type="submit" size="sm" disabled={!hasContent || createPost.isPending}>
                    {createPost.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} className="mr-1" />}
                    {t('post')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="hidden md:block">
            {/* Post type selector */}
            <div className="flex gap-1 overflow-x-auto">
              {/* The API refuses announcements from members. */}
              {POST_TYPES.filter(({ value }) => value !== 'ANNOUNCEMENT' || user?.role === 'ADMIN').map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPostType(value)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
                  style={{
                    background: postType === value ? 'rgba(197,168,128,0.12)' : 'transparent',
                    color: postType === value ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                    border: postType === value ? '1px solid rgba(197,168,128,0.2)' : '1px solid transparent',
                  }}
                >
                  <Icon size={12} />
                  {t(label)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditorMode(editorMode === 'rich' ? 'plain' : 'rich')}
                  className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--theme-text-muted)' }}
                  title={editorMode === 'rich' ? 'Switch to plain text' : 'Switch to rich editor'}
                >
                  {editorMode === 'rich' ? <Type size={13} /> : <PenLine size={13} />}
                  {editorMode === 'rich' ? t('plain') : t('rich')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPoll((v) => !v)}
                  className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: showPoll ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                >
                  <BarChart3 size={13} />
                  {t('createPoll')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCategories((v) => !v)}
                  className="flex items-center gap-1.5 text-xs py-1 px-2 rounded-md hover:bg-white/5 transition-colors"
                  style={{ color: showCategories ? 'var(--theme-primary)' : 'var(--theme-text-muted)' }}
                >
                  <Tag size={13} />
                  {t('tags')}{selectedCategories.length > 0 && ` (${selectedCategories.length})`}
                </button>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                  {t('cancel')}
                </Button>
                <Button type="submit" size="sm" disabled={!hasContent || createPost.isPending}>
                  {createPost.isPending ? (
                    <><Loader2 size={14} className="mr-1.5 animate-spin" />{t('posting')}</>
                  ) : (
                    <><Send size={14} className="mr-1.5" />{t('post')}</>
                  )}
                </Button>
              </div>
            </div>
            </div>
          </>
          )}
        </form>
      </div>
    </section>
  );
}
