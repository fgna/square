import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Users } from 'lucide-react';
import { StatsCard } from './stats-card';

describe('StatsCard', () => {
  it('links the whole card to the page behind the number', () => {
    render(<StatsCard title="Members" value={12} icon={Users} href="/members" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/members');
    expect(screen.getByRole('link')).toHaveTextContent('12');
  });

  it('stays a plain card without a link target', () => {
    render(<StatsCard title="Members" value={12} icon={Users} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
