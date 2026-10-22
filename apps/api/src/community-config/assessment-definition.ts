/**
 * Instrument-definition validation for optional externally managed assessments.
 * This module deliberately does not switch the live assessment service.
 * Issue #191: validate a candidate independently before comparing with legacy.
 */
export interface AssessmentDefinition {
  instrumentId: string;
  instrumentVersion: string;
  dimensions: string[];
  minimumAnswersPerDimension: number;
  questions: Array<{ id: string; dimension: string; text: string; textDe?: string }>;
  recommendationCategories: Record<string, string[]>;
  scoreBands?: { strength: number; solid: number };
}

function record(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
function keys(v: Record<string, unknown>, expected: string[], label: string) {
  if (Object.keys(v).some((k) => !expected.includes(k))) throw new Error(label + ': unexpected property');
}
function word(v: unknown, label: string): string {
  if (typeof v !== 'string' || !v.trim() || v.length > 400) throw new Error(label + ': invalid text');
  return v;
}
export function validateAssessmentDefinition(input: unknown): AssessmentDefinition {
  if (!record(input)) throw new Error('assessment: expected object');
  keys(input, ['instrumentId','instrumentVersion','dimensions','minimumAnswersPerDimension','questions','recommendationCategories','scoreBands'], 'assessment');
  const instrumentId = word(input.instrumentId, 'instrumentId');
  const instrumentVersion = word(input.instrumentVersion, 'instrumentVersion');
  const dims = input.dimensions;
  if (!Array.isArray(dims) || dims.length < 1 || dims.length > 20 || dims.some((v) => typeof v !== 'string' || !/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(v)) || new Set(dims).size !== dims.length) {
    throw new Error('dimensions: invalid');
  }
  const minimumAnswersPerDimension = input.minimumAnswersPerDimension;
  if (!Number.isInteger(minimumAnswersPerDimension) || (minimumAnswersPerDimension as number) < 1 || (minimumAnswersPerDimension as number) > 100) {
    throw new Error('minimumAnswersPerDimension: invalid');
  }
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 100) {
    throw new Error('questions: invalid');
  }
  const questionIds = new Set<string>();
  const questions = input.questions.map((v: unknown) => {
    if (!record(v)) throw new Error('question: invalid');
    keys(v, ['id', 'dimension', 'text', 'textDe'], 'question');
    const id = word(v.id, 'question.id');
    const dimension = word(v.dimension, 'question.dimension');
    const text = word(v.text, 'question.text');
    if (questionIds.has(id) || !dims.includes(dimension)) throw new Error('question: duplicate id or unknown dimension');
    questionIds.add(id);
    const textDe = v.textDe === undefined ? undefined : word(v.textDe, 'question.textDe');
    return { id, dimension, text, ...(textDe ? { textDe } : {}) };
  });
  if (dims.some((d) => questions.filter((q) => q.dimension === d).length < (minimumAnswersPerDimension as number))) {
    throw new Error('questions: too few questions for dimension');
  }
  if (!record(input.recommendationCategories)) throw new Error('recommendationCategories: invalid');
  const mapping: Record<string, string[]> = {};
  for (const [dim, values] of Object.entries(input.recommendationCategories)) {
    if (!dims.includes(dim) || !Array.isArray(values) || values.some((v) => typeof v !== 'string' || !/^[a-z0-9-]+$/.test(v))) {
      throw new Error('recommendationCategories: invalid mapping');
    }
    mapping[dim] = [...values];
  }
  if (dims.some((d) => !(d in mapping))) throw new Error('recommendationCategories: missing dimension');
  let scoreBands: AssessmentDefinition['scoreBands'];
  if (input.scoreBands !== undefined) {
    if (!record(input.scoreBands)) throw new Error('scoreBands: expected object');
    keys(input.scoreBands, ['strength', 'solid'], 'scoreBands');
    const { strength, solid } = input.scoreBands;
    if (typeof strength !== 'number' || typeof solid !== 'number' ||
        !Number.isFinite(strength) || !Number.isFinite(solid) ||
        solid < 1 || strength > 5 || solid >= strength) {
      throw new Error('scoreBands: invalid thresholds');
    }
    scoreBands = { strength, solid };
  }
  return { instrumentId, instrumentVersion, dimensions: [...dims], minimumAnswersPerDimension: minimumAnswersPerDimension as number, questions, recommendationCategories: mapping, ...(scoreBands ? { scoreBands } : {}) };
}
