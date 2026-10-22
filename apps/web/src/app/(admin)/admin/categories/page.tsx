'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Pencil, Trash2, X } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function AdminCategoriesPage() {
  const t = useTranslations('adminCategoriesUI');
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '', color: '#c5a880' });

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => apiClient.get('/categories').then((r) => r.data),
  });

  const createMut = useMutation({
    mutationFn: (data: typeof form) => apiClient.post('/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setCreating(false);
      setForm({ name: '', slug: '', description: '', icon: '', color: '#c5a880' });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<typeof form>) =>
      apiClient.put(`/categories/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditing(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/categories/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories'] }),
  });

  const startEdit = (cat: Category) => {
    setEditing(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      icon: cat.icon || '',
      color: cat.color || '#c5a880',
    });
    setCreating(false);
  };

  const startCreate = () => {
    setCreating(true);
    setEditing(null);
    setForm({ name: '', slug: '', description: '', icon: '', color: '#c5a880' });
  };

  const cancelForm = () => {
    setCreating(false);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
            {t('description')}
          </p>
        </div>
        <Button onClick={startCreate} className="flex items-center gap-2">
          <Plus size={16} /> {t('add')}
        </Button>
      </div>

      {(creating || editing) && (
        <div className="rounded-xl p-6" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold" style={{ color: 'var(--theme-text)' }}>
              {editing ? t('edit') : t('new')}
            </h3>
            <button onClick={cancelForm}><X size={18} style={{ color: 'var(--theme-text-muted)' }} /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>{t('name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: editing ? f.slug : slugify(name) }));
                }}
                placeholder="Community"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('slug')}</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="community"
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>{t('categoryDescription')}</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('sampleDescription')}
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('icon')}</Label>
              <Input
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="🚀"
                className="mt-1"
              />
            </div>
            <div>
              <Label>{t('color')}</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 rounded cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#c5a880"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={cancelForm}>{t('cancel')}</Button>
            <Button
              onClick={() => {
                if (editing) {
                  updateMut.mutate({ id: editing.id, ...form });
                } else {
                  createMut.mutate(form);
                }
              }}
              disabled={createMut.isPending || updateMut.isPending || !form.name || !form.slug}
            >
              {(createMut.isPending || updateMut.isPending) && <Loader2 size={14} className="animate-spin mr-1" />}
              {editing ? t('save') : t('create')}
            </Button>
          </div>
          {(createMut.error || updateMut.error) && (
            <p className="text-xs mt-2" style={{ color: 'var(--theme-danger)' }}>
              {((createMut.error || updateMut.error) as any)?.response?.data?.message || t('error')}
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
        </div>
      ) : (
        <div className="grid gap-3">
          {categories?.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                style={{ background: `${cat.color || '#c5a880'}20`, border: `1px solid ${cat.color || '#c5a880'}40` }}
              >
                {cat.icon || '📁'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{cat.name}</p>
                <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>
                  /{cat.slug} {cat.description && `— ${cat.description}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => startEdit(cat)}>
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { if (confirm(t('deleteConfirm', { name: cat.name }))) deleteMut.mutate(cat.id); }}
                  disabled={deleteMut.isPending}
                  style={{ color: 'var(--theme-danger)' }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
          {categories?.length === 0 && (
            <p className="text-sm text-center py-8" style={{ color: 'var(--theme-text-muted)' }}>
              {t('none')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
