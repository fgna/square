'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, FileText, Calendar, BookOpen, Download, Loader2 } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from '@/store/toast.store';
import { describeError } from '@/lib/query-client';

interface ReportConfig {
  key: string;
  label: string;
  description: string;
  endpoint: string;
  filename: string;
  icon: React.ElementType;
  color: string;
  supportsDateRange: boolean;
}

const REPORTS: ReportConfig[] = [
  {
    key: 'members',
    label: 'members',
    description: 'membersDesc',
    endpoint: '/admin/reports/members',
    filename: 'members.csv',
    icon: Users,
    color: '#3b82f6',
    supportsDateRange: true,
  },
  {
    key: 'posts',
    label: 'posts',
    description: 'postsDesc',
    endpoint: '/admin/reports/posts',
    filename: 'posts.csv',
    icon: FileText,
    color: '#22c55e',
    supportsDateRange: true,
  },
  {
    key: 'events',
    label: 'events',
    description: 'eventsDesc',
    endpoint: '/admin/reports/events',
    filename: 'events.csv',
    icon: Calendar,
    color: '#f59e0b',
    supportsDateRange: true,
  },
  {
    key: 'course-progress',
    label: 'courseProgress',
    description: 'courseProgressDesc',
    endpoint: '/admin/reports/course-progress',
    filename: 'course-progress.csv',
    icon: BookOpen,
    color: '#8b5cf6',
    supportsDateRange: false,
  },
];

export default function ReportsPage() {
  const t = useTranslations('adminReportsUI');
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  async function handleDownload(report: ReportConfig) {
    setDownloading(report.key);
    try {
      const params: Record<string, string> = {};
      if (report.supportsDateRange && dateFrom) params.from = dateFrom;
      if (report.supportsDateRange && dateTo) params.to = dateTo;

      const response = await apiClient.get(report.endpoint, {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // A download is not a mutation, so the global handler never sees it.
      // Without this the button simply resets and the export appears to have
      // been produced.
      toast.error('Export failed', describeError(err));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>{t('title')}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
          {t('description')}
        </p>
      </div>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--theme-text)' }}>
            {t('dateRange')}
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>{t('from')}</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs mb-1 block" style={{ color: 'var(--theme-text-muted)' }}>{t('to')}</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            {(dateFrom || dateTo) && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                >
                  {t('clear')}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {REPORTS.map((report) => {
          const Icon = report.icon;
          const isDownloading = downloading === report.key;
          return (
            <Card key={report.key}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${report.color}18` }}
                  >
                    <Icon size={20} style={{ color: report.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>
                      {t(report.label as 'members')}
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>
                      {t(report.description as 'membersDesc')}
                    </p>
                    {!report.supportsDateRange && (dateFrom || dateTo) && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--theme-text-muted)' }}>
                        {t('notApplicable')}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(report)}
                    disabled={isDownloading}
                    className="flex-shrink-0"
                  >
                    {isDownloading ? (
                      <Loader2 size={14} className="animate-spin mr-1" />
                    ) : (
                      <Download size={14} className="mr-1" />
                    )}
                    CSV
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
