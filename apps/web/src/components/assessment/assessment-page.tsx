'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Loader2, ChevronRight, ChevronLeft, BarChart3, RotateCcw, Compass, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { PageHeader } from '@/components/common/page-header';
import { RadarChart } from './radar-chart';
import { previewText } from '@/lib/preview-text';
import {
  useAssessmentQuestions,
  useLatestAssessment,
  useAssessmentHistory,
  useAssessmentRecommendations,
  useSubmitAssessment,
  useDeleteAssessments,
} from '@/hooks/use-assessments';

const SCALE = [1, 2, 3, 4, 5] as const;
// null = "cannot assess"; it counts for no average.
type Answer = number | null;
import Link from 'next/link';

export function AssessmentPage() {
  const t = useTranslations('assessment');
  const tBands = useTranslations('assessmentBandUI');
  const locale = useLocale() === 'de' ? 'de-DE' : 'en-US';
  const { data: questions, isLoading: questionsLoading } = useAssessmentQuestions();
  const { data: latest, isLoading: latestLoading } = useLatestAssessment();
  const { data: history } = useAssessmentHistory();
  const { data: recommendations } = useAssessmentRecommendations();
  const submitMutation = useSubmitAssessment();
  const deleteMutation = useDeleteAssessments();
  const dimLabel = (key: string) => t.has(`dimensions.${key}`) ? t(`dimensions.${key}`) : key;
  const shortLabel = (key: string) => t.has(`dimensionsShort.${key}`) ? t(`dimensionsShort.${key}`) : dimLabel(key);

  const [mode, setMode] = useState<'view' | 'assess'>('view');
  const [currentDim, setCurrentDim] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [result, setResult] = useState<any>(null);

  if (questionsLoading || latestLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--theme-primary)' }} />
      </div>
    );
  }

  const dimensions = questions?.dimensions || [];
  // Preserve saved instrument dimensions even when the active pack changes.
  const displayAssessment = result || latest;
  const scoreKeys = displayAssessment?.scores ? Object.keys(displayAssessment.scores as Record<string, number | null>) : [];
  const activeKeys: string[] = dimensions.map((dimension: { key: string }) => dimension.key);
  const orderedScoreKeys = [
    ...activeKeys.filter((key) => scoreKeys.includes(key)),
    ...scoreKeys.filter((key) => !activeKeys.includes(key)),
  ];
  const chartLabels = Object.fromEntries(orderedScoreKeys.map((key) => [key, shortLabel(key)]));

  const startAssessment = () => {
    setAnswers({});
    setCurrentDim(0);
    setResult(null);
    setMode('assess');
  };

  const handleAnswer = (questionId: string, score: Answer) => {
    setAnswers((prev) => ({ ...prev, [questionId]: score }));
  };

  const currentDimension = dimensions[currentDim];
  const currentDimQuestions = currentDimension?.questions || [];
  // "Cannot assess" is an answer too; only untouched questions block.
  const allCurrentAnswered = currentDimQuestions.every(
    (q: any) => q.id in answers,
  );

  const handleNext = () => {
    if (currentDim < dimensions.length - 1) {
      setCurrentDim(currentDim + 1);
    }
  };

  const handlePrev = () => {
    if (currentDim > 0) {
      setCurrentDim(currentDim - 1);
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm(t('deleteConfirm'))) return;
    await deleteMutation.mutateAsync();
    setResult(null);
  };

  const handleSubmit = async () => {
    const answerArray = Object.entries(answers).map(([questionId, score]) => ({
      questionId,
      score,
    }));
    const res = await submitMutation.mutateAsync(answerArray);
    setResult(res);
    setMode('view');
  };

  const isLastDim = currentDim === dimensions.length - 1;
  const progressPercent = ((currentDim + 1) / dimensions.length) * 100;

  if (mode === 'assess' && currentDimension) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <PageHeader title={t('title')} description={t('section', { n: currentDim + 1, total: dimensions.length, label: dimLabel(currentDimension.key) })} />

        <Progress value={progressPercent} className="h-2" />

        
        <div className="rounded-xl p-4 space-y-2 text-xs" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)', color: 'var(--theme-text-muted)' }}>
          <p>{t('instructions')}</p>
          <p className="font-semibold pt-1" style={{ color: 'var(--theme-text)' }}>{t('scaleTitle')}</p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-0.5">
            {SCALE.map((n) => (
              <li key={n}><span className="font-semibold" style={{ color: 'var(--theme-primary)' }}>{n}</span> – {String(n)}</li>
            ))}
            <li><span className="font-semibold" style={{ color: 'var(--theme-primary)' }}>–</span> {t('unavailableRating')}</li>
          </ul>
        </div>

        <div className="rounded-xl p-6 space-y-5" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--theme-text)' }}>
            {dimLabel(currentDimension.key)}
          </h2>

          {currentDimQuestions.map((q: any) => (
            <div key={q.id} className="space-y-2">
              <p className="text-sm" style={{ color: 'var(--theme-text)' }}>{q.text}</p>
              <div className="flex flex-wrap gap-2">
                {[...SCALE, null].map((score) => {
                  const selected = answers[q.id] === score;
                  return (
                    <button
                      key={score ?? 'na'}
                      type="button"
                      aria-pressed={selected}
                      title={score == null ? t('unavailableRating') : String(score)}
                      onClick={() => handleAnswer(q.id, score)}
                      className={`${score == null ? 'px-3' : 'flex-1'} py-2 rounded-lg text-sm font-medium transition-all`}
                      style={{
                        background: selected ? 'rgba(197,168,128,0.15)' : 'rgba(255,255,255,0.03)',
                        color: selected ? 'var(--theme-primary)' : 'var(--theme-text-muted)',
                        border: selected ? '1px solid rgba(197,168,128,0.3)' : '1px solid var(--theme-border)',
                      }}
                    >
                      {score ?? t('naShort')}
                    </button>
                  );
                })}
              </div>
              {q.id in answers && (
                <p className="text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                  {answers[q.id] == null ? t('unavailableRating') : String(answers[q.id])}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between">
          <Button variant="outline" onClick={handlePrev} disabled={currentDim === 0}>
            <ChevronLeft size={14} className="mr-1" /> {t('previous')}
          </Button>
          {isLastDim ? (
            <Button onClick={handleSubmit} disabled={!allCurrentAnswered || submitMutation.isPending}>
              {submitMutation.isPending ? (
                <><Loader2 size={14} className="mr-1 animate-spin" /> {t('submitting')}</>
              ) : (
                t('complete')
              )}
            </Button>
          ) : (
            <Button onClick={handleNext} disabled={!allCurrentAnswered}>
              {t('next')} <ChevronRight size={14} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // View mode
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title={t('title')} description={t('description')} />

      {displayAssessment ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Radar chart */}
            <div className="rounded-xl p-6 flex flex-col items-center" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <RadarChart
                scores={displayAssessment.scores as Record<string, number | null>}
                labels={chartLabels}
                dimensions={orderedScoreKeys}
              />
              <div className="mt-4 text-center">
                {displayAssessment.overallScore != null ? (
                  <>
                    <p className="text-3xl font-bold" style={{ color: 'var(--theme-primary)' }}>
                      {displayAssessment.overallScore.toFixed(1)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {t('overall')}
                    </p>
                  </>
                ) : (
                  <p className="text-xs max-w-[16rem]" style={{ color: 'var(--theme-text-muted)' }}>
                    {t('overallMissing')}
                  </p>
                )}
              </div>
            </div>

            {/* Dimension breakdown */}
            <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('dimensionScores')}</h3>
              {orderedScoreKeys.map((key) => {
                const score = (displayAssessment.scores as Record<string, number | null>)[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between gap-3 text-xs">
                      <span style={{ color: 'var(--theme-text)' }}>{dimLabel(key)}</span>
                      <span className="text-right" style={{ color: score == null ? 'var(--theme-text-muted)' : 'var(--theme-primary)' }}>
                        {score == null ? t('notEnough') : `${score.toFixed(1)}/5`}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${((score ?? 0) / 5) * 100}%`,
                          background: 'var(--theme-primary)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
              {t('completed', { date: new Date(displayAssessment.completedAt).toLocaleDateString(locale) })}
            </p>
            <div className="flex flex-wrap gap-2 justify-end">
              <Button onClick={handleDeleteAll} variant="outline" size="sm" disabled={deleteMutation.isPending}>
                <Trash2 size={14} className="mr-1.5" /> {deleteMutation.isPending ? t('deleting') : t('deleteAll')}
              </Button>
              <Button onClick={startAssessment} variant="outline" size="sm">
                <RotateCcw size={14} className="mr-1.5" /> {t('retake')}
              </Button>
            </div>
          </div>

          {/* Development Path */}
          {recommendations?.dimensions?.length > 0 && (
            <div className="rounded-xl p-6 space-y-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('pathTitle')}</h3>
              <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                {t('pathText')}
              </p>

              <div className="space-y-3">
                {recommendations.dimensions.map((d: any) => (
                  <div key={d.key} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--theme-border)' }}>
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <span className="text-sm font-medium" style={{ color: 'var(--theme-text)' }}>{dimLabel(d.key)}</span>
                      <span className="text-xs font-medium text-right" style={{ color: 'var(--theme-primary)' }}>
                        {tBands.has(d.band) ? tBands(d.band) : d.band} · {d.score.toFixed(1)}/5
                      </span>
                    </div>
                    {/* A possible development area gets a first small step for
                        its dimension; strengths and solid areas a shared text. */}
                    <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {d.band === 'develop' && t.has(`suggestions.${d.key}`) ? t(`suggestions.${d.key}`) : t(`suggestions.${d.band}`)}
                    </p>
                    {d.lowestQuestions?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-[11px] font-semibold" style={{ color: 'var(--theme-text)' }}>{t('lowestTitle')}</p>
                        <ul className="space-y-1">
                          {d.lowestQuestions.map((q: any) => (
                            <li key={q.questionId} className="flex gap-2 text-[11px]" style={{ color: 'var(--theme-text-muted)' }}>
                              <span className="font-semibold flex-shrink-0" style={{ color: 'var(--theme-primary)' }}>{q.score}</span>
                              <span>{q.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {d.categories?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {d.categories.map((cat: any) => (
                          <Link
                            key={cat.slug}
                            href={`/explore/${cat.slug}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all hover:scale-105"
                            style={{
                              background: 'rgba(197,168,128,0.08)',
                              color: 'var(--theme-primary)',
                              border: '1px solid rgba(197,168,128,0.15)',
                            }}
                          >
                            <Compass size={10} />
                            {t('explore', { name: cat.name })}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {recommendations.courses?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>{t('suggestedCourses')}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {recommendations.courses.map((c: any) => (
                      <Link key={c.id} href={`/courses/${c.id}`} className="block p-3 rounded-lg transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--theme-border)' }}>
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>{c.title}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--theme-text-muted)' }}>{c.description}</p>
                        {c.progress > 0 && (
                          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <div className="h-full rounded-full" style={{ width: `${c.progress}%`, background: 'var(--theme-primary)' }} />
                          </div>
                        )}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {recommendations.events?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--theme-text-muted)' }}>{t('relevantEvents')}</h4>
                  <div className="space-y-2">
                    {recommendations.events.map((e: any) => (
                      <Link key={e.id} href={`/events#event-${e.id}`} className="flex items-center gap-3 p-3 rounded-lg transition-all hover:opacity-80" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--theme-border)' }}>
                        <div className="text-center flex-shrink-0 w-10">
                          <p className="text-xs font-bold" style={{ color: 'var(--theme-primary)' }}>
                            {new Date(e.startsAt).toLocaleDateString(locale, { day: 'numeric' })}
                          </p>
                          <p className="text-[10px] uppercase" style={{ color: 'var(--theme-text-muted)' }}>
                            {new Date(e.startsAt).toLocaleDateString(locale, { month: 'short' })}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--theme-text)' }}>{e.title}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--theme-text-muted)' }}>{e.description && previewText(e.description)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History */}
          {history?.data?.length > 1 && (
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>{t('history')}</h3>
              <div className="space-y-2">
                {history.data.map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
                      {new Date(a.completedAt).toLocaleDateString(locale)}
                      {/* Earlier questionnaires asked other questions; their values are not comparable. */}
                      {!a.instrumentVersion && ` · ${t('oldInstrument')}`}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'var(--theme-primary)' }}>
                      {a.overallScore != null ? a.overallScore.toFixed(1) : '–'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl p-12 text-center space-y-4" style={{ background: 'var(--theme-card)', border: '1px solid var(--theme-border)' }}>
          <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center" style={{ background: 'rgba(197,168,128,0.1)' }}>
            <BarChart3 size={28} style={{ color: 'var(--theme-primary)' }} />
          </div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--theme-text)' }}>
            {t('introTitle')}
          </h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: 'var(--theme-text-muted)' }}>
            {t('introText', { count: questions?.totalQuestions ?? 30 })}
          </p>
          <Button onClick={startAssessment} size="lg">
            {t('start')}
          </Button>
        </div>
      )}
    </div>
  );
}
