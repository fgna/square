'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, Users, UserX, UserCheck, ChevronDown, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { DeleteMemberDialog } from '@/components/members/delete-member-dialog';
import { getInitials, formatDate } from '@community/shared';
import type { User } from '@community/shared';

function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () =>
      apiClient.get('/admin/users', { params: { search, limit: 50 } }).then((r) => r.data),
  });
}


/** Accounts deleted by their owner keep a placeholder row (see GdprService.deleteAccount). */
function isDeleted(user: { email: string }): boolean {
  return user.email.endsWith('@deleted.invalid');
}

export default function AdminUsersPage() {
  const t = useTranslations('adminUsersUI');
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useAdminUsers(search);
  const [toDelete, setToDelete] = useState<User | null>(null);

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      apiClient.patch(`/admin/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const toggleActive = useMutation({
    // The API toggles; there is no separate activate/deactivate route.
    mutationFn: (id: string) => apiClient.patch(`/admin/users/${id}/toggle-active`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const users: User[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} description={t('count', {count: data?.total ?? 0})} icon={Users} />

      <div className="flex gap-3">
        <Input
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-text)' }}
        />
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)' }}>
              {[t('user'), t('role'), t('status'), t('joined'), t('actions')].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 font-semibold"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))
              : users.map((user) => (
                  <tr
                    key={user.id}
                    className="transition-colors"
                    style={{ borderBottom: '1px solid var(--theme-border)' }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback style={{ background: 'var(--theme-primary)', color: 'var(--theme-background)', fontSize: '11px' }}>
                            {getInitials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium" style={{ color: 'var(--theme-text)' }}>{user.name}</p>
                          <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={user.role === 'ADMIN' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {user.role === 'ADMIN' ? <><Shield size={10} className="mr-1" />{t('admin')}</> : t('member')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {isDeleted(user) ? (
                        <Badge variant="secondary">{t('deleted')}</Badge>
                      ) : (
                      <Badge className={user.isActive ? 'bg-green-500/15 text-green-400 border-green-500/20' : 'bg-red-500/15 text-red-400 border-red-500/20'}>
                        {user.isActive ? t('active') : t('suspended')}
                      </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      {/* The API refuses to demote or suspend yourself, so offer neither.
                          A deleted account cannot be brought back: its data is gone and
                          it can no longer sign in, so it gets no actions at all. */}
                      {user.id !== currentUser?.id && !isDeleted(user) && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() =>
                            changeRole.mutate({ id: user.id, role: user.role === 'ADMIN' ? 'MEMBER' : 'ADMIN' })
                          }
                        >
                          <Shield size={12} className="mr-1" />
                          {user.role === 'ADMIN' ? t('demote') : t('promote')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => toggleActive.mutate(user.id)}
                        >
                          {user.isActive ? <UserX size={12} className="mr-1" /> : <UserCheck size={12} className="mr-1" />}
                          {user.isActive ? t('suspend') : t('restore')}
                        </Button>
                        {/* Admins are demoted first; the API refuses to delete them. */}
                        {user.role !== 'ADMIN' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            style={{ color: 'var(--theme-danger)' }}
                            onClick={() => setToDelete(user)}
                          >
                            <Trash2 size={12} className="mr-1" />
                            {t('delete')}
                          </Button>
                        )}
                      </div>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {toDelete && (
        <DeleteMemberDialog
          member={toDelete}
          onClose={() => setToDelete(null)}
          onDeleted={() => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })}
        />
      )}
    </div>
  );
}
