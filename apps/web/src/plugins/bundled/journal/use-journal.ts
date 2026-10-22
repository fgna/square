import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import { useLocale } from 'next-intl';

export interface MustDoTask {
  text: string;
  done: boolean;
}

export interface JournalContent {
  threeGoals: string[];
  mustDoTasks: MustDoTask[];
  whoIWantToBe: string;
  lookingForwardTo: string;
  importantPeople: string;
  thoughts: string;
}

export const EMPTY_JOURNAL_CONTENT: JournalContent = {
  threeGoals: ['', '', ''],
  mustDoTasks: [
    { text: '', done: false },
    { text: '', done: false },
    { text: '', done: false },
    { text: '', done: false },
    { text: '', done: false },
  ],
  whoIWantToBe: '',
  lookingForwardTo: '',
  importantPeople: '',
  thoughts: '',
};

export interface JournalEntry {
  id: string;
  userId: string;
  content: JournalContent;
  moods: string[];
  date: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertJournalInput {
  content: JournalContent;
  moods?: string[];
}

export interface JournalStats {
  currentStreak: number;
  longestStreak: number;
  totalEntries: number;
  last30DaysCount: number;
  entriesByDate: Record<string, boolean>;
}

function normalizeContent(raw: unknown): JournalContent {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_JOURNAL_CONTENT };
  const obj = raw as Record<string, unknown>;
  return {
    threeGoals: Array.isArray(obj.threeGoals)
      ? (obj.threeGoals as string[]).slice(0, 3)
      : ['', '', ''],
    mustDoTasks: Array.isArray(obj.mustDoTasks)
      ? (obj.mustDoTasks as MustDoTask[]).slice(0, 5)
      : EMPTY_JOURNAL_CONTENT.mustDoTasks,
    whoIWantToBe: typeof obj.whoIWantToBe === 'string' ? obj.whoIWantToBe : '',
    lookingForwardTo: typeof obj.lookingForwardTo === 'string' ? obj.lookingForwardTo : '',
    importantPeople: typeof obj.importantPeople === 'string' ? obj.importantPeople : '',
    thoughts: typeof obj.thoughts === 'string' ? obj.thoughts : '',
  };
}

export function useJournalEntries(month?: string) {
  return useQuery({
    queryKey: ['journal', 'entries', month],
    queryFn: async () => {
      const params = month ? { month } : {};
      const { data } = await apiClient.get<JournalEntry[]>('/p/journal', { params });
      return data.map((e) => ({ ...e, content: normalizeContent(e.content) }));
    },
  });
}

export function useJournalEntry(date: string | null) {
  return useQuery({
    queryKey: ['journal', 'entry', date],
    queryFn: async () => {
      const { data } = await apiClient.get<JournalEntry>(`/p/journal/${date}`);
      return { ...data, content: normalizeContent(data.content) };
    },
    enabled: !!date,
    retry: false,
  });
}

export function useUpsertJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ date, ...input }: UpsertJournalInput & { date: string }) => {
      const { data } = await apiClient.put<JournalEntry>(`/p/journal/${date}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });
}

export function useDeleteJournal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { data } = await apiClient.delete(`/p/journal/${date}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });
}

export function useJournalStats() {
  return useQuery({
    queryKey: ['journal', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<JournalStats>('/p/journal/stats');
      return data;
    },
  });
}

export interface JournalPrompt {
  id: string;
  category: string;
  text: string;
  color: string;
}

export function useJournalPrompts() {
  const locale = useLocale();
  return useQuery({
    queryKey: ['journal-prompts', locale],
    queryFn: async () => {
      const { data } = await apiClient.get<JournalPrompt[]>('/p/journal/prompts', { params: { locale } });
      return data;
    },
    staleTime: 1000 * 60 * 60,
  });
}
