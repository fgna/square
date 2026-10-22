import { Skeleton } from '@/components/ui/skeleton';

export function PostSkeleton() {
  return (
    <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-16" />
      </div>
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2 w-full rounded-full mt-3" />
      </div>
    </div>
  );
}

export function MemberSkeleton() {
  return (
    <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
