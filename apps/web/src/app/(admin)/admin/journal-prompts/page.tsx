'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Eye, EyeOff, Pencil, X, Check, GripVertical } from 'lucide-react';

interface PromptCategory {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  sortOrder: number;
  _count: { prompts: number };
}

interface Prompt {
  id: string;
  text: string;
  categoryId: string;
  isActive: boolean;
  sortOrder: number;
  category: { id: string; name: string; color: string };
}

function useCategories() {
  return useQuery<PromptCategory[]>({
    queryKey: ['admin', 'journal-categories'],
    queryFn: () => apiClient.get('/p/journal/admin/categories').then((r) => r.data),
  });
}

function usePrompts(categoryId?: string) {
  return useQuery<Prompt[]>({
    queryKey: ['admin', 'journal-prompts', categoryId],
    queryFn: () => {
      const params = categoryId ? { categoryId } : {};
      return apiClient.get('/p/journal/admin/prompts', { params }).then((r) => r.data);
    },
  });
}

// ── Category Section ─────────────────────────────────────────────────────

function CategoryManager() {
  const t = useTranslations('adminJournalUI');
  const qc = useQueryClient();
  const { data: categories, isLoading } = useCategories();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'journal-categories'] });
    qc.invalidateQueries({ queryKey: ['admin', 'journal-prompts'] });
    qc.invalidateQueries({ queryKey: ['journal-prompts'] });
  };

  const createMut = useMutation({
    mutationFn: (data: { name: string; color: string }) => apiClient.post('/p/journal/admin/categories', data),
    onSuccess: () => { invalidate(); setAdding(false); setNewName(''); setNewColor('#8b5cf6'); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; color?: string; isActive?: boolean }) =>
      apiClient.patch(`/p/journal/admin/categories/${id}`, data),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/p/journal/admin/categories/${id}`),
    onSuccess: invalidate,
  });

  if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('categories')}</h3>
        <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
          {adding ? <X size={14} /> : <Plus size={14} />}
          <span className="ml-1">{adding ? t('cancel') : t('add')}</span>
        </Button>
      </div>

      {adding && (
        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <Input placeholder={t('categoryName')} value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
            <div className="flex items-center gap-2">
              <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
              <Button size="sm" onClick={() => createMut.mutate({ name: newName, color: newColor })} disabled={!newName.trim()}>
                {t('create')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories?.map((cat) => (
          <Card key={cat.id}>
            <CardContent className="p-4">
              {editingId === cat.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <div className="flex items-center gap-2">
                    <input type="color" value={editColor} onChange={(e) => setEditColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-0" />
                    <Button size="sm" onClick={() => updateMut.mutate({ id: cat.id, name: editName, color: editColor })}>
                      <Check size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      <X size={14} />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>{cat.name}</p>
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{t('promptsCount', {count: cat._count.prompts})}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateMut.mutate({ id: cat.id, isActive: !cat.isActive })}
                      title={cat.isActive ? t('hideCategory') : t('showCategory')}
                    >
                      {cat.isActive ? <Eye size={14} /> : <EyeOff size={14} style={{ opacity: 0.4 }} />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setEditingId(cat.id); setEditName(cat.name); setEditColor(cat.color); }}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { if (confirm(t('deleteCategory', {name: cat.name}))) deleteMut.mutate(cat.id); }}
                    >
                      <Trash2 size={14} className="text-red-400" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Prompts Section ──────────────────────────────────────────────────────

function PromptManager() {
  const t = useTranslations('adminJournalUI');
  const qc = useQueryClient();
  const { data: categories } = useCategories();
  const [filterCat, setFilterCat] = useState<string | undefined>(undefined);
  const { data: prompts, isLoading } = usePrompts(filterCat);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [newCatId, setNewCatId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin', 'journal-prompts'] });
    qc.invalidateQueries({ queryKey: ['admin', 'journal-categories'] });
    qc.invalidateQueries({ queryKey: ['journal-prompts'] });
  };

  const createMut = useMutation({
    mutationFn: (data: { text: string; categoryId: string }) => apiClient.post('/p/journal/admin/prompts', data),
    onSuccess: () => { invalidate(); setAdding(false); setNewText(''); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string; text?: string; isActive?: boolean }) =>
      apiClient.patch(`/p/journal/admin/prompts/${id}`, data),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/p/journal/admin/prompts/${id}`),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('prompts')}</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant={!filterCat ? 'default' : 'ghost'}
            onClick={() => setFilterCat(undefined)}
          >
            {t('all')}
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              size="sm"
              variant={filterCat === cat.id ? 'default' : 'ghost'}
              onClick={() => setFilterCat(cat.id)}
            >
              <div className="w-2.5 h-2.5 rounded-full mr-1.5" style={{ background: cat.color }} />
              {cat.name}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setAdding(!adding)}>
            {adding ? <X size={14} /> : <Plus size={14} />}
            <span className="ml-1">{adding ? t('cancel') : t('add')}</span>
          </Button>
        </div>
      </div>

      {adding && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Textarea
              placeholder={t('promptText')}
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-3">
              <select
                value={newCatId}
                onChange={(e) => setNewCatId(e.target.value)}
                className="text-sm rounded-lg px-3 py-2 flex-1"
                style={{ background: 'var(--theme-card)', color: 'var(--theme-text)', border: '1px solid var(--theme-border)' }}
              >
                <option value="">{t('selectCategory')}</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <Button size="sm" onClick={() => createMut.mutate({ text: newText, categoryId: newCatId })} disabled={!newText.trim() || !newCatId}>
                {t('create')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {prompts?.map((prompt) => (
            <Card key={prompt.id}>
              <CardContent className="p-4">
                {editingId === prompt.id ? (
                  <div className="space-y-2">
                    <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updateMut.mutate({ id: prompt.id, text: editText })}>
                        <Check size={14} className="mr-1" /> {t('save')}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>{t('cancel')}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <GripVertical size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--theme-text-muted)', opacity: 0.4 }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="secondary"
                          className="text-[10px]"
                          style={{ background: `${prompt.category.color}20`, color: prompt.category.color }}
                        >
                          {prompt.category.name}
                        </Badge>
                        {!prompt.isActive && (
                          <Badge variant="outline" className="text-[10px]" style={{ opacity: 0.5 }}>{t('hidden')}</Badge>
                        )}
                      </div>
                      <p className="text-sm" style={{ color: 'var(--theme-text)', opacity: prompt.isActive ? 1 : 0.5 }}>
                        {prompt.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => updateMut.mutate({ id: prompt.id, isActive: !prompt.isActive })}
                        title={prompt.isActive ? t('hidePrompt') : t('showPrompt')}
                      >
                        {prompt.isActive ? <Eye size={14} /> : <EyeOff size={14} style={{ opacity: 0.4 }} />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setEditingId(prompt.id); setEditText(prompt.text); }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { if (confirm(t('deletePrompt'))) deleteMut.mutate(prompt.id); }}
                      >
                        <Trash2 size={14} className="text-red-400" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {prompts?.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--theme-text-muted)' }}>
              {t('noPrompts')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function JournalPromptsAdminPage() {
  const t = useTranslations('adminJournalUI');
  const method = useQuery<{ source: 'legacy' | 'pack' }>({
    queryKey: ['journal-method'],
    queryFn: () => apiClient.get('/p/journal/method').then(r => r.data),
    retry: false,
  });
  if (method.isPending) return <p role="status">Loading journal administration...</p>;
  if (method.isError) return <p role="alert">Journal configuration could not be loaded.</p>;
  const readOnly = method.data?.source === 'pack';
  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      {readOnly && <p role="status">These prompts and categories belong to the external content pack and cannot be edited here.</p>}
      <fieldset disabled={readOnly} className="space-y-6">
        <CategoryManager />
        <div style={{ borderTop: '1px solid var(--theme-border)' }} className="pt-6">
          <PromptManager />
        </div>
      </fieldset>
    </div>
  );
}
