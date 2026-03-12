import { ArrowLeft, ArrowRight, History, Play, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'

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
  PracticeSetView,
} from '../lib/sync-view-model'
import type { ToeicWebSyncV1 } from '../lib/sync-schema'
import { Badge } from './Badge'
import { EmptyMessage } from './DashboardBlocks'
import { SectionCard } from './SectionCard'

type PracticeTab = 'history' | 'start'

interface SessionState {
  sessionId: string
  startedAt: string
  set: PracticeSetView
  currentIndex: number
  answers: Record<string, PracticeSessionAnswer>
}

interface SummaryState {
  attemptId: string
  title: string
  answeredCount: number
  correctCount: number
  wrongCount: number
}

export function PracticeWorkspace({
  syncData,
  viewModel,
  onClose,
  onCommitSync,
  onNotify,
}: {
  syncData: ToeicWebSyncV1
  viewModel: DashboardViewModel
  onClose: () => void
  onCommitSync: (
    nextSync: ToeicWebSyncV1,
    options: { title: string; description: string },
  ) => void
  onNotify: (toast: { title: string; description: string; tone: BadgeTone }) => void
}) {
  const [tab, setTab] = useState<PracticeTab>('start')
  const [selectedSetId, setSelectedSetId] = useState(viewModel.practiceSets[0]?.id ?? null)
  const [selectedAttemptId, setSelectedAttemptId] = useState(
    viewModel.practiceHistory[0]?.attemptId ?? null,
  )
  const [session, setSession] = useState<SessionState | null>(null)
  const [summary, setSummary] = useState<SummaryState | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [memoDrafts, setMemoDrafts] = useState<Record<string, string>>({})

  const selectedSet = useMemo(
    () =>
      viewModel.practiceSets.find((set) => set.id === selectedSetId) ??
      viewModel.practiceSets[0] ??
      null,
    [selectedSetId, viewModel.practiceSets],
  )
  const selectedRecord = useMemo(
    () =>
      viewModel.practiceHistory.find((record) => record.attemptId === selectedAttemptId) ??
      viewModel.practiceHistory[0] ??
      null,
    [selectedAttemptId, viewModel.practiceHistory],
  )
  const memoDraft = selectedRecord
    ? (memoDrafts[selectedRecord.attemptId] ?? selectedRecord.note)
    : ''

  const currentQuestion =
    session && session.set.availableItems.length > 0
      ? session.set.availableItems[session.currentIndex]
      : null
  const currentAnswer = currentQuestion ? session?.answers[currentQuestion.key] ?? null : null

  function beginSession() {
    if (!selectedSet || selectedSet.availableItems.length === 0) {
      onNotify({
        title: '풀이를 시작할 수 없습니다.',
        description: '현재 바로 풀 수 있는 문항이 없습니다.',
        tone: 'accent',
      })
      return
    }

    setSession({
      sessionId: `practice-session-${Date.now()}`,
      startedAt: new Date().toISOString(),
      set: selectedSet,
      currentIndex: 0,
      answers: {},
    })
    setSummary(null)
  }

  function answer(choiceKey: string) {
    setSession((current) => {
      if (!current) {
        return current
      }

      const question = current.set.availableItems[current.currentIndex]
      if (!question || current.answers[question.key]) {
        return current
      }

      return {
        ...current,
        answers: {
          ...current.answers,
          [question.key]: {
            itemKey: question.key,
            itemId: question.itemId,
            questionNo: question.questionNo,
            selectedAnswer: choiceKey,
            correctAnswer: question.correctAnswer,
            result: choiceKey === question.correctAnswer ? 'correct' : 'wrong',
          },
        },
      }
    })
  }

  function finishSession() {
    if (!session) {
      return
    }

    const answers = Object.values(session.answers)
    if (answers.length === 0) {
      setConfirmOpen(false)
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
      items: session.set.availableItems,
      answers,
    })

    onCommitSync(nextSync, {
      title: 'RC 문제 풀이 기록을 저장했습니다.',
      description: `${nextSummary.title} · ${formatNumber(nextSummary.answeredCount)}문항`,
    })
    setSelectedAttemptId(nextSummary.attemptId)
    setSummary(nextSummary)
    setSession(null)
    setConfirmOpen(false)
    setTab('history')
  }

  function saveMemo() {
    if (!selectedRecord) {
      return
    }

    onCommitSync(appendPracticeNote(syncData, selectedRecord, memoDraft), {
      title: '풀이 메모를 저장했습니다.',
      description: `${selectedRecord.title} · 메모 저장`,
    })
  }

  if (summary) {
    return (
      <SectionCard title="풀이 종료 개요" subtitle="기록으로 바로 이동할 수 있습니다.">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">푼 문제 {formatNumber(summary.answeredCount)}</div>
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">맞은 문제 {formatNumber(summary.correctCount)}</div>
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">틀린 문제 {formatNumber(summary.wrongCount)}</div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white" onClick={() => { setSummary(null); setTab('history'); setSelectedAttemptId(summary.attemptId) }} type="button">기록 보기</button>
          <button className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" onClick={() => { setSummary(null); setTab('start') }} type="button">새 문제 풀이 준비</button>
          <button className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" onClick={onClose} type="button">대시보드로 돌아가기</button>
        </div>
      </SectionCard>
    )
  }

  if (session && currentQuestion) {
    return (
      <>
        <SectionCard
          title="RC 문제 풀이"
          subtitle={`${session.set.title} · ${formatNumber(session.currentIndex + 1)} / ${formatNumber(session.set.availableItems.length)}`}
          action={<button className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900" onClick={() => setConfirmOpen(true)} type="button">종료</button>}
        >
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone="brand">{currentQuestion.part}</Badge>
              <Badge>{currentQuestion.questionType}</Badge>
              <Badge>{currentQuestion.questionNo}번</Badge>
              <Badge tone={currentAnswer?.result === 'correct' ? 'success' : currentAnswer ? 'danger' : 'neutral'}>
                {currentAnswer ? (currentAnswer.result === 'correct' ? '정답' : '오답') : '미응답'}
              </Badge>
            </div>
            {currentQuestion.passages.length > 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                {currentQuestion.passages.map((passage) => (
                  <article key={passage.passage_id} className="space-y-2">
                    {passage.title ? <h3 className="font-medium text-slate-900">{passage.title}</h3> : null}
                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{passage.body}</p>
                  </article>
                ))}
              </div>
            ) : null}
            <article className="rounded-3xl border border-slate-200 bg-white p-4">
              <p className="text-lg font-semibold leading-8 text-slate-950">{currentQuestion.stem}</p>
              <div className="mt-4 grid gap-3">
                {currentQuestion.choices.map((choice) => {
                  const tone = !currentAnswer ? 'neutral' : choice.key === currentQuestion.correctAnswer ? 'success' : choice.key === currentAnswer.selectedAnswer ? 'danger' : 'neutral'
                  return (
                    <button
                      className={cn('rounded-3xl border px-4 py-4 text-left text-sm leading-6', tone === 'success' && 'border-emerald-300 bg-emerald-50 text-emerald-950', tone === 'danger' && 'border-rose-300 bg-rose-50 text-rose-950', tone === 'neutral' && 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300 hover:bg-blue-50')}
                      disabled={Boolean(currentAnswer)}
                      key={choice.key}
                      onClick={() => answer(choice.key)}
                      type="button"
                    >
                      <div className="flex items-start gap-3"><Badge tone={tone}>{choice.key}</Badge><span>{choice.text}</span></div>
                    </button>
                  )
                })}
              </div>
            </article>
            <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 pt-4">
              <p className="text-sm text-slate-600">답한 문항 {formatNumber(Object.keys(session.answers).length)} / {formatNumber(session.set.availableItems.length)}</p>
              <div className="flex gap-3">
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={session.currentIndex === 0} onClick={() => setSession((current) => current ? { ...current, currentIndex: Math.max(0, current.currentIndex - 1) } : current)} type="button"><ArrowLeft className="size-4" />이전</button>
                <button className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-50" disabled={session.currentIndex === session.set.availableItems.length - 1} onClick={() => setSession((current) => current ? { ...current, currentIndex: Math.min(current.set.availableItems.length - 1, current.currentIndex + 1) } : current)} type="button">다음<ArrowRight className="size-4" /></button>
              </div>
            </div>
          </div>
        </SectionCard>
        {confirmOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
            <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_90px_rgba(15,23,42,0.28)]">
              <p className="font-semibold text-slate-950">이번 풀이를 종료할까요?</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">현재까지 답한 문항은 {formatNumber(Object.keys(session.answers).length)}개입니다.</p>
              <div className="mt-4 flex justify-end gap-3">
                <button className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700" onClick={() => setConfirmOpen(false)} type="button">계속 풀기</button>
                <button className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white" onClick={finishSession} type="button">종료</button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="RC 문제 풀이 허브"
        subtitle="기록과 새 문제 풀이를 한곳에서 관리합니다."
        action={<button className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700" onClick={onClose} type="button">대시보드로 돌아가기</button>}
      >
        <div className="flex flex-wrap gap-2">
          <button className={cn('inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold', tab === 'history' ? 'border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700')} onClick={() => setTab('history')} type="button"><History className="size-4" />기록</button>
          <button className={cn('inline-flex min-h-11 items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold', tab === 'start' ? 'border-blue-200 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700')} onClick={() => setTab('start')} type="button"><Play className="size-4" />문제 풀이 시작</button>
        </div>
      </SectionCard>

      {tab === 'start' ? (
        <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
          <SectionCard title="세트 선택" subtitle="JSON에 들어 있는 세트만 사용합니다.">
            {viewModel.practiceSets.length ? viewModel.practiceSets.map((set) => (
              <button className={cn('mb-3 w-full rounded-3xl border p-4 text-left', set.id === selectedSet?.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50')} key={set.id} onClick={() => setSelectedSetId(set.id)} type="button">
                <div className="mb-2 flex flex-wrap gap-2"><Badge tone="brand">{set.part}</Badge><Badge>{set.sourceKind}</Badge></div>
                <p className="font-medium text-slate-950">{set.title}</p>
                <p className="mt-1 text-sm text-slate-600">{set.anchor}</p>
                <p className="mt-2 text-xs text-slate-500">바로 출제 {formatNumber(set.availableCount)}문항 / 이미 출제 {formatNumber(set.issuedCount)}문항</p>
              </button>
            )) : <EmptyMessage text="풀이 가능한 RC 세트가 없습니다." />}
          </SectionCard>
          <SectionCard title="출제 구성" subtitle={selectedSet ? `${selectedSet.title} · 바로 출제 ${formatNumber(selectedSet.availableCount)}문항` : '세트를 먼저 선택해 주세요.'} action={<button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={!selectedSet || selectedSet.availableItems.length === 0} onClick={beginSession} type="button"><Play className="mr-2 inline size-4" />문제 풀이 시작</button>}>
            {selectedSet ? (
              <div className="grid gap-6 xl:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-900">이번에 바로 풀 문제</h3>
                  {selectedSet.availableItems.length ? selectedSet.availableItems.map((question) => (
                    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4" key={question.key}><div className="mb-2 flex gap-2"><Badge tone="brand">{question.questionNo}번</Badge><Badge>{question.questionType}</Badge></div><p className="text-sm leading-6 text-slate-800">{question.stem}</p></article>
                  )) : <EmptyMessage text="현재 바로 풀 수 있는 문항이 없습니다." />}
                </div>
                <div className="space-y-3">
                  <h3 className="font-medium text-slate-900">이미 출제된 문제</h3>
                  {selectedSet.issuedItems.length ? selectedSet.issuedItems.map((question) => (
                    <article className="rounded-3xl border border-amber-200 bg-amber-50 p-4" key={question.key}><div className="mb-2 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2"><Badge tone="accent">{question.questionNo}번</Badge><Badge>{question.questionType}</Badge></div><button className="rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-900" onClick={() => onCommitSync(appendPracticeItemAvailability(syncData, question, 'available'), { title: '문항을 다시 출제 가능 상태로 변경했습니다.', description: `${question.questionNo}번 문항` })} type="button"><RotateCcw className="mr-2 inline size-4" />다시 출제 허용</button></div><p className="text-sm leading-6 text-slate-800">{question.stem}</p></article>
                  )) : <EmptyMessage text="이미 출제된 문제는 아직 없습니다." />}
                </div>
              </div>
            ) : <EmptyMessage text="세트를 선택하면 출제 상태를 보여줍니다." />}
          </SectionCard>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
          <SectionCard title="풀이 기록" subtitle="최근 풀이 순서대로 보여줍니다.">
            {viewModel.practiceHistory.length ? viewModel.practiceHistory.map((record) => (
              <button className={cn('mb-3 w-full rounded-3xl border p-4 text-left', record.attemptId === selectedRecord?.attemptId ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50')} key={record.attemptId} onClick={() => setSelectedAttemptId(record.attemptId)} type="button"><div className="mb-2 flex gap-2"><Badge tone="brand">{record.part}</Badge><Badge>{record.sourceKind}</Badge>{record.note.trim() ? <Badge tone="accent">메모 있음</Badge> : null}</div><p className="font-medium text-slate-950">{record.title}</p><p className="mt-1 text-sm text-slate-600">{formatDateTime(record.timestamp)}</p><p className="mt-2 text-xs text-slate-500">푼 문제 {formatNumber(record.answeredCount)}개 / 오답 {formatNumber(record.wrongCount)}개</p></button>
            )) : <EmptyMessage text="아직 RC 문제 풀이 기록이 없습니다." />}
          </SectionCard>
          <SectionCard title="기록 상세" subtitle="방금 종료한 기록도 여기에서 바로 확인할 수 있습니다.">
            {selectedRecord ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">푼 문제 {formatNumber(selectedRecord.answeredCount)}</div>
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-4">정답 {formatNumber(selectedRecord.correctCount)}</div>
                  <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4">오답 {formatNumber(selectedRecord.wrongCount)}</div>
                </div>
                <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold tracking-[0.14em] text-slate-500">문제 목록</p>
                  {selectedRecord.items.length ? selectedRecord.items.map((item) => (
                    <article className="rounded-3xl border border-slate-200 bg-white p-4" key={item.key}><div className="mb-2 flex gap-2"><Badge tone="brand">{item.questionNo}번</Badge><Badge tone={item.result === 'correct' ? 'success' : item.result === 'wrong' ? 'danger' : 'neutral'}>{item.result === 'correct' ? '정답' : item.result === 'wrong' ? '오답' : '미확정'}</Badge>{item.missingItem ? <Badge tone="danger">삭제된 문항</Badge> : null}</div><p className="text-sm leading-6 text-slate-800">{item.stem}</p><p className="mt-2 text-xs text-slate-500">선택 답 {item.selectedAnswer} / 정답 {item.correctAnswer}</p></article>
                  )) : <EmptyMessage text="연결된 문항 응답 이벤트가 없습니다." />}
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 font-medium text-slate-950">메모</p>
                  <textarea className="min-h-36 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-900 outline-none focus:border-blue-400" onChange={(event) => setMemoDrafts((current) => ({ ...current, [selectedRecord.attemptId]: event.target.value }))} placeholder="이 풀이에서 헷갈린 점, 다음에 다시 볼 포인트를 메모하세요." value={memoDraft} />
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">메모는 `study_note.recorded` 이벤트로 JSON에 저장됩니다.</p>
                    <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white" onClick={saveMemo} type="button">메모 저장</button>
                  </div>
                </div>
              </div>
            ) : <EmptyMessage text="왼쪽에서 풀이 기록을 선택하면 상세 내용과 메모를 보여줍니다." />}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
