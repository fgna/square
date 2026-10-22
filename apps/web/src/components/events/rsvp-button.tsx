'use client';

import { Check, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRsvp, useCancelRsvp } from '@/hooks/use-events';
import type { CommunityEvent } from '@community/shared';

interface RsvpButtonProps {
  event: CommunityEvent;
}

export function RsvpButton({ event }: RsvpButtonProps) {
  const rsvp = useRsvp(event.id);
  const cancelRsvp = useCancelRsvp(event.id);
  const currentRsvp = event.userRsvp;

  if (currentRsvp) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium"
          style={{
            background: currentRsvp.status === 'GOING' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
            border: `1px solid ${currentRsvp.status === 'GOING' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
            color: currentRsvp.status === 'GOING' ? '#22c55e' : '#f59e0b',
          }}
        >
          <Check size={12} />
          {currentRsvp.status === 'GOING' ? 'Going' : 'Maybe'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs h-7 px-2"
          onClick={() => cancelRsvp.mutate()}
          disabled={cancelRsvp.isPending}
        >
          {cancelRsvp.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="flex-1 text-xs h-7"
        onClick={() => rsvp.mutate('GOING')}
        disabled={rsvp.isPending}
      >
        {rsvp.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
        Going
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-xs h-7 px-3"
        onClick={() => rsvp.mutate('MAYBE')}
        disabled={rsvp.isPending}
        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-text-muted)' }}
      >
        Maybe
      </Button>
    </div>
  );
}
