'use client';

import { useQuery } from '@tanstack/react-query';
import { ClipboardList } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { formatDate } from '@community/shared';

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-green-500/15 text-green-400 border-green-500/20',
  UPDATE: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
  DELETE: 'bg-red-500/15 text-red-400 border-red-500/20',
  LOGIN: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
};

function actionColor(action: string) {
  const key = Object.keys(ACTION_COLORS).find((k) => action.toUpperCase().includes(k));
  return key ? ACTION_COLORS[key] : 'bg-gray-500/15 text-gray-400 border-gray-500/20';
}

export default function AdminAuditLogPage() {
  const t = useTranslations('adminAuditUI');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'audit-log', page],
    queryFn: () => apiClient.get('/admin/audit-log', { params: { page, limit: 50 } }).then((r) => r.data),
  });

  const entries: AuditEntry[] = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('count', {count: data?.total ?? 0})}
        icon={ClipboardList}
      />

      <div
        className="rounded-xl overflow-x-auto"
        style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--theme-border)' }}>
              {[t('time'), t('user'), t('action'), t('resource'), t('details')].map((h) => (
                <th
                  key={h}
                  className="text-left px-4 py-3 font-semibold text-xs"
                  style={{ color: 'var(--theme-text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <Skeleton className="h-3 w-20" />
                      </td>
                    ))}
                  </tr>
                ))
              : entries.length === 0
              ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('none')}
                    </td>
                  </tr>
                )
              : entries.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--theme-border)' }}>
                    <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: 'var(--theme-text-muted)' }}>
                      {formatDate(entry.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium" style={{ color: 'var(--theme-text)' }}>{entry.user.name}</p>
                      <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>{entry.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs ${actionColor(entry.action)}`}>{entry.action}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--theme-text)' }}>
                      {entry.resource}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono max-w-[200px] truncate" style={{ color: 'var(--theme-text-muted)' }}>
                      {entry.metadata ? JSON.stringify(entry.metadata) : '—'}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          <span>{t('page', {page, total: data.totalPages})}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              {t('previous')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}>
              {t('next')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
