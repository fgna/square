import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminCoursesPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

describe('Admin courses list on a phone', () => {
  it('opens the editor from the course title and lets the table scroll instead of cutting it off', async () => {
    api.get.mockImplementation(async (url: string) => (url === '/courses'
      ? { data: { data: [{ id: 'c1', title: 'Führen statt Reagieren', description: 'Warum Du …', isPublished: true, createdAt: '2026-10-01T00:00:00Z', _count: { modules: 5 } }] } }
      : { data: {} }));
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AdminCoursesPage />
      </QueryClientProvider>,
    );
    const title = await screen.findByRole('link', { name: 'Führen statt Reagieren' });
    expect(title.getAttribute('href')).toBe('/admin/courses/c1');
    const wrapper = screen.getByRole('table').parentElement!;
    expect(wrapper.className).toContain('overflow-x-auto');
    expect(wrapper.className).not.toContain('overflow-hidden');
  });
});
