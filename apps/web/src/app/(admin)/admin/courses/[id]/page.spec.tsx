import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import deMessages from '../../../../../../messages/de.json';
import CourseEditorPage from './page';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
vi.mock('@/lib/api-client', () => ({ default: api }));
vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'c1' }) }));
// The test setup translates into English; this page is checked in German.
vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: (namespace?: string) =>
      actual.createTranslator({ locale: 'de', messages: deMessages, namespace: namespace as never }),
    useLocale: () => 'de',
  };
});

const course = {
  id: 'c1', title: 'Führen statt Reagieren', description: 'Warum Du mit klaren Grenzen führst',
  isPublished: true, releaseMode: 'DRIP', coverUrl: null, categories: [],
  modules: [{ id: 'm1', title: 'Grundlagen', lessons: [
    { id: 'l1', moduleId: 'm1', title: 'Einstieg', content: '', videoUrl: null, releaseAfterDays: 0, attachments: [] },
  ] }],
};

function renderGerman() {
  api.get.mockImplementation(async (url: string) => ({ data: url === '/courses/c1' ? course : url.includes('participation') ? { course: { lessons: 1 }, summary: { started: 0, completed: 0, activeLast30Days: 0 }, members: [] } : [] }));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CourseEditorPage />
    </QueryClientProvider>,
  );
}

describe('Course editor in German', () => {
  it('shows settings, modules and lessons in the member language', async () => {
    renderGerman();
    expect(await screen.findByText('Kurseinstellungen')).toBeTruthy();
    expect(screen.getByText('Module und Lektionen')).toBeTruthy();
    expect(screen.getByText('Schritt für Schritt')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Lektion hinzufügen/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Modul hinzufügen/ })).toBeTruthy();
    expect(screen.getByText('Tag 0')).toBeTruthy();
    expect(screen.queryByText('Course settings')).toBeNull();
  });

  it('asks before deleting a module, naming its lessons', async () => {
    renderGerman();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Modul löschen' }));
    expect(confirm).toHaveBeenCalledWith('Modul „Grundlagen“ mit 1 Lektion löschen? Das lässt sich nicht rückgängig machen.');
  });

  it('opens the lesson dialog in German', async () => {
    renderGerman();
    fireEvent.click(await screen.findByRole('button', { name: 'Lektion bearbeiten' }));
    expect(await screen.findByRole('heading', { name: 'Lektion bearbeiten' })).toBeTruthy();
    expect(screen.getByText('Text unter dem Video')).toBeTruthy();
    expect(screen.getByText(/Tagen, nachdem das Mitglied den Kurs begonnen hat/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lektion speichern' })).toBeTruthy();
  });
});
