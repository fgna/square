import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import enCore from '../../../messages/en.json';

// Rating labels as a method pack names them (the Core default is one word).
const packScale = {
  '1': 'Never or almost never',
  '2': 'Rarely',
  '3': 'Sometimes',
  '4': 'Mostly',
  '5': '(Almost) always',
  na: 'No opportunity in the last 3 months',
};
const withPack = vi.hoisted(() => ({ on: true }));

vi.mock('next-intl', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next-intl')>();
  return {
    ...actual,
    useTranslations: (namespace?: string) => {
      const messages = withPack.on
        ? { ...enCore, assessment: { ...enCore.assessment, scale: packScale } }
        : enCore;
      return actual.createTranslator({ locale: 'en', messages, namespace: namespace as never });
    },
    useLocale: () => 'en',
  };
});

vi.mock('@/hooks/use-assessments', () => ({
  useAssessmentQuestions: () => ({
    data: { dimensions: [{ key: 'G', questions: [{ id: 'q1', text: 'I ask for feedback.' }] }] },
    isLoading: false,
  }),
  useLatestAssessment: () => ({ data: null, isLoading: false }),
  useAssessmentHistory: () => ({ data: undefined }),
  useAssessmentRecommendations: () => ({ data: undefined }),
  useSubmitAssessment: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAssessments: () => ({ mutate: vi.fn(), isPending: false }),
}));

import { AssessmentPage } from './assessment-page';

async function startAssessment() {
  render(<AssessmentPage />);
  await userEvent.click(screen.getByRole('button', { name: enCore.assessment.start }));
}

describe('AssessmentPage rating scale', () => {
  beforeEach(() => {
    withPack.on = true;
  });

  it('explains every rating with the method pack wording', async () => {
    await startAssessment();
    expect(screen.getByText(/Never or almost never/)).toBeInTheDocument();
    expect(screen.getByText(/\(Almost\) always/)).toBeInTheDocument();
    expect(screen.getByText(/No opportunity in the last 3 months/)).toBeInTheDocument();
    expect(screen.queryByText('1 – 1')).toBeNull();
  });

  it('names the chosen rating below the question', async () => {
    await startAssessment();
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.getByText('4 – Mostly')).toBeInTheDocument();
  });

  it('shows plain numbers when the pack names no ratings', async () => {
    withPack.on = false;
    await startAssessment();
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(screen.queryByText(/Mostly/)).toBeNull();
    expect(screen.queryByText('1 – 1')).toBeNull();
    expect(screen.queryByText(/4 –/)).toBeNull();
  });
});
