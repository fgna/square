'use client';

import { useEffect, useState } from 'react';
import type { PluginPageProps, WebPlugin } from '@community/plugin-sdk/web';

type Task = {
  id: string;
  version: number;
  prompt: string;
  responseType: 'number' | 'single_choice' | 'multiple_choice';
  options?: { id: string; label: string }[];
  hintCount: number;
};
type Attempt = { correct: boolean; hintsUsed: number };
type HistoricalAttempt = Attempt & { id: string; taskId: string; taskVersion: number; createdAt: string };
type PendingSubmission = { taskId: string; taskVersion: number; response: number | string[]; idempotencyKey: string };

function QuizPage({ api }: PluginPageProps) {
  const [task, setTask] = useState<Task | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [number, setNumber] = useState('');
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<HistoricalAttempt[]>([]);
  const [pending, setPending] = useState<PendingSubmission | null>(null);

  useEffect(() => {
    let active = true;
    api.get<HistoricalAttempt[]>('attempts')
      .then(rows => { if (active) setHistory(rows); })
      .catch(() => { if (active) setError('Could not load previous attempts.'); });
    api.get<Task[]>('tasks')
      .then(rows => { if (active) { setTasks(rows); setTask(rows[0] ?? null); } })
      .catch(() => { if (active) setError('Could not load the task.'); });
    return () => { active = false; };
  }, [api]);

  async function submit() {
    if (!task || busy) return;
    const response = task.responseType === 'number' ? Number(number) : [...selected];
    if (task.responseType === 'number' && (number.trim() === '' || !Number.isFinite(response as number))) {
      setError('Enter a valid number.');
      return;
    }
    if (task.responseType !== 'number' && selected.length === 0) {
      setError('Select an answer.');
      return;
    }
    const submission = pending ?? {
      taskId: task.id, taskVersion: task.version, response,
      idempotencyKey: globalThis.crypto.randomUUID().replaceAll('-', '_')
    };
    setPending(submission);
    setBusy(true);
    setError('');
    try {
      const result = await api.post<Attempt>('attempts', submission);
      setAttempt(result);
      setPending(null);
      const rows = await api.get<HistoricalAttempt[]>('attempts');
      setHistory(rows);
    } catch {
      setError('Could not confirm saving. Try again to resend the same attempt.');
    } finally { setBusy(false); }
  }

  async function revealHint() {
    if (!task || busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ text: string }>('hints/reveal', {
        taskId: task.id, taskVersion: task.version
      });
      setHint(result.text);
    } catch { setError('Hint unavailable.'); }
    finally { setBusy(false); }
  }

  if (!task) return <div role="status">{error || 'Loading task…'}</div>;

  return <main className="mx-auto max-w-xl space-y-4 p-4">
    <h1 className="text-2xl font-bold">Practice</h1>
    <label className="block">Task
      <select aria-label="Task" value={task.id} disabled={busy || !!pending}
        onChange={e => {
          const next = tasks.find(item => item.id === e.target.value);
          if (next) { setTask(next); setSelected([]); setNumber(''); setAttempt(null); setHint(null); setError(''); }
        }} className="block w-full rounded border p-2">
        {tasks.map(item => <option key={item.id} value={item.id}>{item.prompt}</option>)}
      </select>
    </label>
    <p>{task.prompt}</p>
    {task.responseType === 'number'
      ? <label className="block">Your answer
          <input aria-label="Your answer" type="number" value={number}
            onChange={e => { if (!pending) setNumber(e.target.value); }} disabled={!!pending} className="block w-full rounded border p-2" />
        </label>
      : <fieldset className="space-y-2">
          <legend>{task.responseType === 'multiple_choice' ? 'Select all correct answers' : 'Select one answer'}</legend>
          {(task.options || []).map(option => <label key={option.id} className="flex gap-2">
            <input type={task.responseType === 'multiple_choice' ? 'checkbox' : 'radio'}
              name="answer" disabled={!!pending} checked={selected.includes(option.id)}
              onChange={e => setSelected(current => task.responseType === 'single_choice'
                ? [option.id] : e.target.checked
                  ? [...current, option.id] : current.filter(id => id !== option.id))} />
            {option.label}
          </label>)}
        </fieldset>}
    {task.hintCount > 0 && <button type="button" disabled={busy}
      className="rounded border p-2" onClick={revealHint}>Show hint</button>}
    {hint && <p role="note">{hint}</p>}
    <button type="button" disabled={busy} className="rounded border p-2" onClick={submit}>
      {busy ? 'Saving…' : 'Check answer'}
    </button>
    {attempt && <p role="status">{attempt.correct ? 'Correct' : 'Try again'}{attempt.hintsUsed > 0 ? ' (with hint)' : ''}</p>}
    {history.length > 0 && <section aria-label="Your previous attempts">
      <h2 className="font-semibold">Your previous attempts</h2>
      <p>{history.filter(item => item.taskId === task.id && item.taskVersion === task.version).length} recorded attempts for this task</p>
    </section>}
    {error && <p role="alert">{error}</p>}
  </main>;
}

const plugin: WebPlugin = { Page: QuizPage };
export default plugin;
