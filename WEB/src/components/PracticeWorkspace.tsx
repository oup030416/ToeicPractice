import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CircleCheckBig,
  History,
  NotebookPen,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import {
  appendPracticeAttempt,
  appendPracticeItemAvailability,
  appendPracticeNote,
  type PracticeSessionAnswer,
} from '../lib/practice'
import { cn, formatDateTime, formatNumber } from '../lib/format'
import type {
  BadgeTone,
  DashboardViewModel,
  PracticeQuestionView,
  PracticeRecordView,
  PracticeSetView,
} from '../lib/sync-view-model'
import type { ToeicWebSyncV1 } from '../lib/sync-schema'
import { Badge } from './Badge'
import { EmptyMessage } from './DashboardBlocks'
import { SectionCard } from './SectionCard'

type PracticeTab = 'history' | 'start'

interface PracticeSessionState {
  sessionId: string
  startedAt: string
  set: PracticeSetView
  items: PracticeQuestionView[]
  currentIndex: number
  answers: Record<string, PracticeSessionAnswer>
}

interface PracticeSummaryState {
  attemptId: string
  title: string
  answeredCount: number
  correctCount: number
  wrongCount: number
}

interface PracticeWorkspaceProps {
  syncData: ToeicWebSyncV1
  viewModel: DashboardViewModel
  onClose: () => void
  onCommitSync: (
    nextSync: ToeicWebSyncV1,
    options: {
      title: string
      description: string
    },
  ) => void
  onNotify: (toast: {
    title: string
    description: string
    tone: BadgeTone
  }) => void
}

function buildSessionId() {
  return `practice-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function answerTone(
  choiceKey: string,
  currentQuestion: PracticeQuestionView,
  answer: PracticeSessionAnswer | null,
) {
  if (!answer) {
    return 'neutral' as const
  }

  if (choiceKey === currentQuestion.correctAnswer) {
    return 'success' as const
  }

  if (choiceKey === answer.selectedAnswer) {
    return 'danger' as const
  }

  return 'neutral' as const
}

function resultTone(result: PracticeRecordView['items'][number]['result']) {
  if (result === 'correct') {
    return 'success' as const
  }

  if (result === 'wrong') {
    return 'danger' as const
  }

  return 'neutral' as const
}

function PracticeConfirmDialog({
  open,
  answeredCount,
  onConfirm,
  onCancel,
}: {
  open: boolean
  answeredCount: number
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div
        aria-modal="true"
        className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)]"
        role="dialog"
      >
        <div className="space-y-3">
          <Badge tone="accent">종료 확인</Badge>
          <h2 className="font-mono text-xl font-semibold text-slate-950">
            이번 풀이를 종료할까요?
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            현재까지 답한 문항은 {formatNumber(answeredCount)}개입니다. 답한 문항이 있으면
            요약을 만들고 기록으로 이동할 수 있습니다.
          </p>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onCancel}
            type="button"
          >
            계속 풀기
          </button>
          <button
            className="rounded-2xl border border-rose-200 bg-rose-600 px-4 py-3 text-sm font-semibold text-white hover:bg-rose-700"
            onClick={onConfirm}
            type="button"
          >
            종료
          </button>
        </div>
      </div>
    </div>
  )
}

export function PracticeWorkspace({
  syncData,
  viewModel,
  onClose,
  onCommitSync,
  onNotify,
}: PracticeWorkspaceProps) {
  const [tab, setTab] = useState<PracticeTab>('start')
  const [selectedSetId, setSelectedSetId] = useState<string | null>(
    viewModel.practiceSets[0]?.id ?? null,
  )
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(
    viewModel.practiceHistory[0]?.attemptId ?? null,
  )
  const [session, setSession] = useState<PracticeSessionState | null>(null)
  const [summary, setSummary] = useState<PracticeSummaryState | null>(null)
  const [showExitConfirm, setShowExitConfirm] = useState(false)
  const [memoDraft, setMemoDraft] = useState('')

  useEffect(() => {
    if (!viewModel.practiceSets.some((set) => set.id === selectedSetId)) {
      setSelectedSetId(viewModel.practiceSets[0]?.id ?? null)
    }
  }, [selectedSetId, viewModel.practiceSets])

  useEffect(() => {
    if (!viewModel.practiceHistory.some((record) => record.attemptId === selectedAttemptId)) {
      setSelectedAttemptId(viewModel.practiceHistory[0]?.attemptId ?? null)
    }
  }, [selectedAttemptId, viewModel.practiceHistory])

  const selectedSet = useMemo(
    () => viewModel.practiceSets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, viewModel.practiceSets],
  )

  const selectedRecord = useMemo(
    () =>
      viewModel.practiceHistory.find((record) => record.attemptId === selectedAttemptId) ??
      null,
    [selectedAttemptId, viewModel.practiceHistory],
  )

  useEffect(() => {
    setMemoDraft(selectedRecord?.note ?? '')
  }, [selectedRecord?.attemptId, selectedRecord?.note])

  function startSession() {
    if (!selectedSet || selectedSet.availableItems.length === 0) {
      onNotify({
        title: '풀이를 시작할 수 없습니다.',
        description: '현재 바로 풀 수 있는 문항이 없습니다.',
        tone: 'accent',
      })
      return
    }

    setSession({
      sessionId: buildSessionId(),
      startedAt: new Date().toISOString(),
      set: selectedSet,
      items: selectedSet.availableItems,
      currentIndex: 0,
      answers: {},
    })
    setSummary(null)
  }

  function answerCurrentQuestion(choiceKey: string) {
    setSession((current) => {
      if (!current) {
        return current
      }

      const currentQuestion = current.items[current.currentIndex]
      if (!currentQuestion || current.answers[currentQuestion.key]) {
        return current
      }

      const answer: PracticeSessionAnswer = {
        itemKey: currentQuestion.key,
        itemId: currentQuestion.itemId,
        questionNo: currentQuestion.questionNo,
        selectedAnswer: choiceKey,
        correctAnswer: currentQuestion.correctAnswer,
        result: choiceKey === currentQuestion.correctAnswer ? 'correct' : 'wrong',
      }

      return {
        ...current,
        answers: {
          ...current.answers,
          [currentQuestion.key]: answer,
        },
      }
    })
  }

  function confirmExitSession() {
    if (!session) {
      return
    }

    const answers = Object.values(session.answers)

    if (answers.length === 0) {
      setShowExitConfirm(false)
      setSession(null)
      onNotify({
        title: '답한 문항이 없어 기록을 만들지 않았습니다.',
        description: '문제 풀이 시작 화면으로 돌아갑니다.',
        tone: 'accent',
      })
      return
    }

    const { nextSync, summary: nextSummary } = appendPracticeAttempt(syncData, {
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      setId: session.set.id,
      sourceKind: session.set.sourceKind,
      setTitle: session.set.title,
      sourceAnchor: session.set.anchor,
      part: session.set.part,
      items: session.items,
      answers,
    })

    onCommitSync(nextSync, {
      title: 'RC 문제 풀이 기록을 저장했습니다.',
      description: `${nextSummary.title} · ${formatNumber(nextSummary.answeredCount)}문항`,
    })
    setSelectedAttemptId(nextSummary.attemptId)
    setSummary(nextSummary)
    setSession(null)
    setShowExitConfirm(false)
    setTab('history')
  }

  function saveRecordMemo() {
    if (!selectedRecord) {
      return
    }

    const nextSync = appendPracticeNote(syncData, selectedRecord, memoDraft)
    onCommitSync(nextSync, {
      title: '풀이 메모를 저장했습니다.',
      description: `${selectedRecord.title} · 메모 ${memoDraft.trim() ? '갱신' : '비움'}`,
    })
  }

  function allowReissue(question: PracticeQuestionView) {
    const nextSync = appendPracticeItemAvailability(syncData, question, 'available')
    onCommitSync(nextSync, {
      title: '문항을 다시 출제 가능 상태로 변경했습니다.',
      description: `${question.questionNo}번 문항`,
    })
  }

  if (summary) {
    return (
      <section className="space-y-6">
        <SectionCard
          action={
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              대시보드로 돌아가기
            </button>
          }
          subtitle="종료 직후 생성된 풀이 요약입니다."
          title="풀이 종료 개요"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm text-slate-500">푼 문제 수</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {formatNumber(summary.answeredCount)}
              </p>
            </div>
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-sm text-emerald-800">맞은 문제 수</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-emerald-950">
                {formatNumber(summary.correctCount)}
              </p>
            </div>
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
              <p className="text-sm text-rose-800">틀린 문제 수</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-rose-950">
                {formatNumber(summary.wrongCount)}
              </p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => {
                setSummary(null)
                setTab('history')
                setSelectedAttemptId(summary.attemptId)
              }}
              type="button"
            >
              <History className="size-4" />
              기록 보기
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => {
                setSummary(null)
                setTab('start')
              }}
              type="button"
            >
              <RotateCcw className="size-4" />
              새 문제 풀이 준비
            </button>
          </div>
        </SectionCard>
      </section>
    )
  }

  if (session) {
    const currentQuestion = session.items[session.currentIndex]
    const currentAnswer = currentQuestion ? session.answers[currentQuestion.key] ?? null : null
    const answeredCount = Object.keys(session.answers).length

    return (
      <>
        <section className="space-y-6">
          <SectionCard
            action={
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-100"
                onClick={() => setShowExitConfirm(true)}
                type="button"
              >
                <X className="size-4" />
                종료
              </button>
            }
            subtitle={`${session.set.title} · ${formatNumber(session.currentIndex + 1)} / ${formatNumber(session.items.length)}`}
            title="RC 문제 풀이"
          >
            {currentQuestion ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="brand">{currentQuestion.part}</Badge>
                  <Badge>{currentQuestion.questionType}</Badge>
                  <Badge tone="neutral">{currentQuestion.questionNo}번</Badge>
                  <Badge
                    tone={
                      currentAnswer?.result === 'correct'
                        ? 'success'
                        : currentAnswer
                          ? 'danger'
                          : 'neutral'
                    }
                  >
                    {currentAnswer ? (currentAnswer.result === 'correct' ? '정답' : '오답') : '미응답'}
                  </Badge>
                </div>

                {currentQuestion.passages.length > 0 ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="mb-3 text-sm font-semibold tracking-[0.14em] text-slate-500">
                      지문
                    </p>
                    <div className="space-y-4">
                      {currentQuestion.passages.map((passage) => (
                        <article key={passage.passage_id} className="space-y-2">
                          {passage.title ? (
                            <h3 className="font-medium text-slate-900">{passage.title}</h3>
                          ) : null}
                          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                            {passage.body}
                          </p>
                        </article>
                      ))}
                    </div>
                  </div>
                ) : null}

                <article className="rounded-3xl border border-slate-200 bg-white p-5">
                  <p className="text-lg font-semibold leading-8 text-slate-950">
                    {currentQuestion.stem}
                  </p>
                  <div className="mt-5 grid gap-3">
                    {currentQuestion.choices.map((choice) => {
                      const tone = answerTone(choice.key, currentQuestion, currentAnswer)

                      return (
                        <button
                          className={cn(
                            'rounded-3xl border px-4 py-4 text-left text-sm leading-6',
                            tone === 'success' &&
                              'border-emerald-300 bg-emerald-50 text-emerald-950',
                            tone === 'danger' &&
                              'border-rose-300 bg-rose-50 text-rose-950',
                            tone === 'neutral' &&
                              'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-blue-50',
                            currentAnswer && 'cursor-default',
                          )}
                          disabled={Boolean(currentAnswer)}
                          key={choice.key}
                          onClick={() => answerCurrentQuestion(choice.key)}
                          type="button"
                        >
                          <div className="flex items-start gap-3">
                            <Badge tone={tone}>{choice.key}</Badge>
                            <span>{choice.text}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {currentAnswer ? (
                    <div
                      className={cn(
                        'mt-5 rounded-3xl border p-4 text-sm leading-6',
                        currentAnswer.result === 'correct'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                          : 'border-rose-200 bg-rose-50 text-rose-950',
                      )}
                    >
                      <p className="font-semibold">
                        {currentAnswer.result === 'correct' ? '정답입니다.' : '오답입니다.'}
                      </p>
                      <p className="mt-1">정답: {currentQuestion.correctAnswer}</p>
                      {currentQuestion.explanation ? (
                        <p className="mt-2">{currentQuestion.explanation}</p>
                      ) : null}
                    </div>
                  ) : null}
                </article>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    답한 문항 {formatNumber(answeredCount)} / {formatNumber(session.items.length)}
                  </p>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={session.currentIndex === 0}
                      onClick={() =>
                        setSession((current) =>
                          current
                            ? { ...current, currentIndex: Math.max(0, current.currentIndex - 1) }
                            : current,
                        )
                      }
                      type="button"
                    >
                      <ArrowLeft className="size-4" />
                      이전
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={session.currentIndex === session.items.length - 1}
                      onClick={() =>
                        setSession((current) =>
                          current
                            ? {
                                ...current,
                                currentIndex: Math.min(
                                  current.items.length - 1,
                                  current.currentIndex + 1,
                                ),
                              }
                            : current,
                        )
                      }
                      type="button"
                    >
                      다음
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyMessage text="표시할 문제를 찾지 못했습니다." />
            )}
          </SectionCard>
        </section>

        <PracticeConfirmDialog
          answeredCount={answeredCount}
          onCancel={() => setShowExitConfirm(false)}
          onConfirm={confirmExitSession}
          open={showExitConfirm}
        />
      </>
    )
  }

  return (
    <section className="space-y-6">
      <SectionCard
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setTab('history')}
              type="button"
            >
              기록
            </button>
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => setTab('start')}
              type="button"
            >
              문제 풀이 시작
            </button>
            <button
              className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              대시보드로 돌아가기
            </button>
          </div>
        }
        subtitle="기록 탭에서는 지난 RC 풀이 내역과 메모를 보고, 시작 탭에서는 세트별 출제 가능 문항을 바로 시작할 수 있습니다."
        title="RC 문제 풀이 허브"
      >
        <div className="flex flex-wrap gap-2">
          <button
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold',
              tab === 'history'
                ? 'border-blue-200 bg-blue-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            )}
            onClick={() => setTab('history')}
            type="button"
          >
            <History className="size-4" />
            기록
          </button>
          <button
            className={cn(
              'inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold',
              tab === 'start'
                ? 'border-blue-200 bg-blue-600 text-white'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            )}
            onClick={() => setTab('start')}
            type="button"
          >
            <Play className="size-4" />
            문제 풀이 시작
          </button>
        </div>
      </SectionCard>

      {tab === 'start' ? (
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <SectionCard subtitle="JSON에 들어 있는 세트만 사용합니다." title="세트 선택">
            {viewModel.practiceSets.length > 0 ? (
              <div className="space-y-3">
                {viewModel.practiceSets.map((set) => (
                  <button
                    className={cn(
                      'w-full rounded-3xl border p-4 text-left',
                      set.id === selectedSetId
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50',
                    )}
                    key={set.id}
                    onClick={() => setSelectedSetId(set.id)}
                    type="button"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{set.part}</Badge>
                      <Badge>{set.sourceKind}</Badge>
                    </div>
                    <p className="font-medium text-slate-950">{set.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{set.anchor}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>전체 {formatNumber(set.totalCount)}문항</span>
                      <span>바로 출제 {formatNumber(set.availableCount)}문항</span>
                      <span>이미 출제 {formatNumber(set.issuedCount)}문항</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyMessage text="풀이 가능한 RC 세트가 없습니다." />
            )}
          </SectionCard>

          <SectionCard
            action={
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedSet || selectedSet.availableItems.length === 0}
                onClick={startSession}
                type="button"
              >
                <BookOpenCheck className="size-4" />
                문제 풀이 시작
              </button>
            }
            subtitle={
              selectedSet
                ? `${selectedSet.title} · 바로 출제 ${formatNumber(selectedSet.availableCount)}문항`
                : '세트를 먼저 선택해 주세요.'
            }
            title="출제 구성"
          >
            {selectedSet ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">전체 문항</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">
                      {formatNumber(selectedSet.totalCount)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">이번에 바로 풀 문제</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-emerald-950">
                      {formatNumber(selectedSet.availableCount)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm text-amber-800">이미 출제된 문제</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-amber-950">
                      {formatNumber(selectedSet.issuedCount)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="space-y-3">
                    <h3 className="font-medium text-slate-900">이번에 바로 풀 문제</h3>
                    {selectedSet.availableItems.length > 0 ? (
                      selectedSet.availableItems.map((question) => (
                        <article
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                          key={question.key}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge tone="brand">{question.questionNo}번</Badge>
                            <Badge>{question.questionType}</Badge>
                          </div>
                          <p className="text-sm leading-6 text-slate-800">{question.stem}</p>
                        </article>
                      ))
                    ) : (
                      <EmptyMessage text="현재 바로 풀 수 있는 문항이 없습니다." />
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-medium text-slate-900">이미 출제된 문제</h3>
                    {selectedSet.issuedItems.length > 0 ? (
                      selectedSet.issuedItems.map((question) => (
                        <article
                          className="rounded-3xl border border-amber-200 bg-amber-50 p-4"
                          key={question.key}
                        >
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge tone="accent">{question.questionNo}번</Badge>
                              <Badge>{question.questionType}</Badge>
                            </div>
                            <button
                              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                              onClick={() => allowReissue(question)}
                              type="button"
                            >
                              <RotateCcw className="size-4" />
                              다시 출제 허용
                            </button>
                          </div>
                          <p className="text-sm leading-6 text-slate-800">{question.stem}</p>
                        </article>
                      ))
                    ) : (
                      <EmptyMessage text="이미 출제된 문제는 아직 없습니다." />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <EmptyMessage text="세트를 선택하면 출제 상태를 보여줍니다." />
            )}
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <SectionCard subtitle="최근 풀이 순서대로 보여줍니다." title="풀이 기록">
            {viewModel.practiceHistory.length > 0 ? (
              <div className="space-y-3">
                {viewModel.practiceHistory.map((record) => (
                  <button
                    className={cn(
                      'w-full rounded-3xl border p-4 text-left',
                      record.attemptId === selectedAttemptId
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 bg-slate-50 hover:border-blue-200 hover:bg-blue-50',
                    )}
                    key={record.attemptId}
                    onClick={() => setSelectedAttemptId(record.attemptId)}
                    type="button"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge tone="brand">{record.part}</Badge>
                      <Badge>{record.sourceKind}</Badge>
                      {record.note.trim() ? <Badge tone="accent">메모 있음</Badge> : null}
                    </div>
                    <p className="font-medium text-slate-950">{record.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{formatDateTime(record.timestamp)}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>푼 문제 {formatNumber(record.answeredCount)}개</span>
                      <span>정답 {formatNumber(record.correctCount)}개</span>
                      <span>오답 {formatNumber(record.wrongCount)}개</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyMessage text="아직 RC 문제 풀이 기록이 없습니다." />
            )}
          </SectionCard>

          <SectionCard subtitle="방금 종료한 기록도 여기에서 바로 확인할 수 있습니다." title="기록 상세">
            {selectedRecord ? (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">푼 문제 수</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">
                      {formatNumber(selectedRecord.answeredCount)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">
                    <p className="text-sm text-emerald-800">정답 수</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-emerald-950">
                      {formatNumber(selectedRecord.correctCount)}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">
                    <p className="text-sm text-rose-800">오답 수</p>
                    <p className="mt-2 font-mono text-2xl font-semibold text-rose-950">
                      {formatNumber(selectedRecord.wrongCount)}
                    </p>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold tracking-[0.14em] text-slate-500">
                    문제 목록
                  </p>
                  {selectedRecord.items.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {selectedRecord.items.map((item) => (
                        <article
                          className="rounded-3xl border border-slate-200 bg-white p-4"
                          key={item.key}
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <Badge tone="brand">{item.questionNo}번</Badge>
                            <Badge tone={resultTone(item.result)}>
                              {item.result === 'correct' ? '정답' : item.result === 'wrong' ? '오답' : '미확정'}
                            </Badge>
                            <Badge>{item.questionType}</Badge>
                            {item.missingItem ? <Badge tone="danger">삭제된 문항</Badge> : null}
                          </div>
                          <p className="text-sm leading-6 text-slate-800">{item.stem}</p>
                          <p className="mt-3 text-xs text-slate-500">
                            선택 답 {item.selectedAnswer} / 정답 {item.correctAnswer}
                          </p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-6 text-slate-500">
                      연결된 문항 응답 이벤트가 없습니다.
                    </p>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <NotebookPen className="size-4 text-blue-800" />
                    <p className="font-medium text-slate-950">메모</p>
                  </div>
                  <textarea
                    className="min-h-36 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400"
                    onChange={(event) => setMemoDraft(event.target.value)}
                    placeholder="이 풀이에서 헷갈린 점, 다음에 다시 볼 포인트를 메모하세요."
                    value={memoDraft}
                  />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      메모는 `study_note.recorded` 이벤트로 JSON에 저장됩니다.
                    </p>
                    <button
                      className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-blue-200 bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
                      onClick={saveRecordMemo}
                      type="button"
                    >
                      <CircleCheckBig className="size-4" />
                      메모 저장
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyMessage text="왼쪽에서 풀이 기록을 선택하면 상세 내용과 메모를 보여줍니다." />
            )}
          </SectionCard>
        </div>
      )}
    </section>
  )
}
