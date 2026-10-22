import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
}

export function StatsCard({ title, value, description, icon: Icon, trend }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium" style={{ color: 'var(--theme-text-muted)' }}>
              {title}
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--theme-text)' }}>
              {value}
            </p>
            {description && (
              <p className="text-xs mt-1" style={{ color: 'var(--theme-text-muted)' }}>
                {description}
              </p>
            )}
            {trend && (
              <p
                className="text-xs mt-1 font-medium"
                style={{ color: trend.value >= 0 ? 'var(--theme-success)' : 'var(--theme-danger)' }}
              >
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div
            className="p-3 rounded-xl flex-shrink-0"
            style={{ background: 'rgba(197,168,128,0.1)', border: '1px solid rgba(197,168,128,0.2)' }}
          >
            <Icon size={20} style={{ color: 'var(--theme-primary)' }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
