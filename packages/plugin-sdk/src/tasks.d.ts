/** General-purpose solvable task contract (v1). Domain learning rules are external. */
export type TaskResponseType = 'number';
export interface NumericTaskDefinition {
  schemaVersion: 1;
  id: string;
  version: number;
  responseType: 'number';
  prompt: string;
  /** Exact expected numeric result, stored server-side and never included in learner payloads. */
  expected: number;
  hints?: string[];
}
export interface PublicNumericTask {
  id: string;
  version: number;
  responseType: 'number';
  prompt: string;
  hintCount: number;
}
export interface TaskAttemptInput {
  taskId: string;
  taskVersion: number;
  idempotencyKey: string;
  response: number;
  /** Number of hints actually revealed to the participant by the server. */
  // Hint usage must be derived server-side, not accepted as trusted client input.
}
export interface TaskAttemptRecord {
  id: string;
  memberId: string;
  taskId: string;
  taskVersion: number;
  response: number;
  correct: boolean;
  hintsUsed: number;
  createdAt: string;
  idempotencyKey: string;
}
