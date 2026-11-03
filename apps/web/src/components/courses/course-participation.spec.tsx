import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CourseParticipation } from './course-participation';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));

describe('CourseParticipation', () => {
  it('shows the summary and each member with progress and lessons', async () => {
    api.get.mockResolvedValue({
      data: {
        course: { id: 'c1', title: 'Kurs', lessons: 5 },
        summary: { started: 2, completed: 1, activeLast30Days: 1 },
        members: [{ id: 'u1', name: 'Ann', percentage: 40, completedLessons: 2, startedAt: '2026-10-01T10:00:00Z', lastActivityAt: '2026-10-20T10:00:00Z', completedAt: null }],
      },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CourseParticipation courseId="c1" />
      </QueryClientProvider>,
    );
    expect(await screen.findByText('2 started · 1 completed · 1 active in the last 30 days')).toBeInTheDocument();
    expect(screen.getByText('Ann')).toBeInTheDocument();
    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/courses/c1/participation');
  });
});
