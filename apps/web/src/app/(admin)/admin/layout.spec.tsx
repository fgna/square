import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminLayout from './layout';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/courses/c1' }));
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { email: 'admin@example.com' } }) }));

describe('AdminLayout', () => {
  it('keeps the content as wide as the screen, so wide tables scroll in their own box', () => {
    render(<AdminLayout><table><tbody><tr><td>wide</td></tr></tbody></table></AdminLayout>);
    // Without min-w-0 the flex item grows to its widest child (jsdom has no layout,
    // so the class is the observable contract).
    expect(screen.getByRole('main').className.split(' ')).toContain('min-w-0');
  });
});
