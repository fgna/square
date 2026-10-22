import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(197,168,128,0.08)', border: '1px solid rgba(197,168,128,0.15)' }}
      >
        <Icon size={28} style={{ color: 'var(--theme-primary)', opacity: 0.7 }} />
      </div>
      <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>
        {title}
      </h3>
      <p className="text-sm max-w-xs" style={{ color: 'var(--theme-text-muted)' }}>
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
