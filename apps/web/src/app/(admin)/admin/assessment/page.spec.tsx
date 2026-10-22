import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminAssessmentPage from './page';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api-client', () => ({ default: { get } }));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><AdminAssessmentPage /></QueryClientProvider>);
}

describe('neutral assessment administration', () => {
  beforeEach(() => { get.mockReset(); });

  it('lists the external instrument read-only in dimension and sort order', async () => {
    get.mockImplementation(async (url: string) => {
      if (url === '/assessments/admin/mode') return { data: { readOnly: true } };
      if (url === '/assessments/admin/questions') return { data: [
        { id: 'b', questionId: 'b', dimension: 'Focus', text: 'Second question', sortOrder: 1, isActive: true },
        { id: 'a', questionId: 'a', dimension: 'Focus', text: 'First question', sortOrder: 0, isActive: true },
      ] };
      throw new Error('Unexpected API request');
    });
    renderPage();
    expect(await screen.findByText('First question')).toBeInTheDocument();
    expect(screen.getByText('Second question')).toBeInTheDocument();
    expect(screen.getByText('Managed by the instance content pack')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save|delete|edit/i })).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/assessments/admin/mode');
    expect(get).toHaveBeenCalledWith('/assessments/admin/questions');
  });

  it('does not request questions when the admin mode endpoint rejects access', async () => {
    get.mockRejectedValue(new Error('Forbidden'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load instrument');
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith('/assessments/admin/mode');
  });
});
