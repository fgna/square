import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}

export function PageHeader({ title, description, action, icon: Icon }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(197,168,128,0.12)', color: 'var(--theme-primary)' }}
          >
            <Icon size={20} />
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
