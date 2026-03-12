import type { PracticeQuestionView, PracticeRecordView } from './sync-view-model'
import type { ToeicWebSyncEvent, ToeicWebSyncV1 } from './sync-schema'

export interface PracticeSessionAnswer {
  itemKey: string
  itemId: string
  questionNo: number
  selectedAnswer: string
  correctAnswer: string
  result: 'correct' | 'wrong'
}

export interface PracticeSessionCommitInput {
  sessionId: string
  startedAt: string
  completedAt: string
  setId: string
  sourceKind: 'official' | 'drill'
  setTitle: string
  sourceAnchor: string
  part: string
  items: PracticeQuestionView[]
  answers: PracticeSessionAnswer[]
}

export interface PracticeCompletionSummary {
  attemptId: string
  answeredCount: number
  correctCount: number
  wrongCount: number
  title: string
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneSync(sync: ToeicWebSyncV1) {
  return JSON.parse(JSON.stringify(sync)) as ToeicWebSyncV1
}

function createBaseEvent(
  sync: ToeicWebSyncV1,
  overrides: Partial<ToeicWebSyncEvent> & Pick<ToeicWebSyncEvent, 'event_type' | 'entity_type' | 'entity_id' | 'payload'>,
): ToeicWebSyncEvent {
  return {
    event_id: createId('evt'),
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    actor: overrides.actor ?? 'web',
    event_type: overrides.event_type,
    entity_type: overrides.entity_type,
    entity_id: overrides.entity_id,
    session_id: overrides.session_id ?? '',
    attempt_id: overrides.attempt_id ?? '',
    payload: overrides.payload,
    supersedes_event_id: overrides.supersedes_event_id ?? null,
  }
}

function finalizeSync(sync: ToeicWebSyncV1, events: ToeicWebSyncEvent[]) {
  const nextSync = cloneSync(sync)
  nextSync.events.push(...events)
  nextSync.meta = {
    ...nextSync.meta,
    exported_at: new Date().toISOString(),
    exported_by: 'web',
    event_count: nextSync.events.length,
  }

  return nextSync
}

export function appendPracticeItemAvailability(
  sync: ToeicWebSyncV1,
  question: Pick<PracticeQuestionView, 'sourceSetId' | 'sourceKind' | 'itemId' | 'questionNo'>,
  availability: 'available' | 'issued',
) {
  const event = createBaseEvent(sync, {
    event_type: 'raw_record.corrected',
    entity_type: 'practice_item_pool',
    entity_id: `${question.sourceSetId}:${question.itemId}`,
    session_id: `practice-pool-${question.sourceSetId}`,
    payload: {
      target_type: 'practice_item_pool',
      source_set_id: question.sourceSetId,
      source_kind: question.sourceKind,
      item_id: question.itemId,
      question_no: question.questionNo,
      availability,
    },
  })

  return finalizeSync(sync, [event])
}

export function appendPracticeAttempt(
  sync: ToeicWebSyncV1,
  session: PracticeSessionCommitInput,
) {
  const answeredItems = session.items.filter((item) =>
    session.answers.some((answer) => answer.itemKey === item.key),
  )
  const answersByKey = new Map(session.answers.map((answer) => [answer.itemKey, answer]))
  const correctCount = session.answers.filter((answer) => answer.result === 'correct').length
  const answeredCount = session.answers.length
  const wrongCount = answeredCount - correctCount
  const attemptId = createId('attempt')
  const skillTag = answeredItems[0]?.skillTag ?? 'mixed'
  const accuracy = answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100)

  const attemptEvent = createBaseEvent(sync, {
    event_type: 'attempt.recorded',
    entity_type: 'practice_attempt',
    entity_id: attemptId,
    session_id: session.sessionId,
    attempt_id: attemptId,
    timestamp: session.completedAt,
    payload: {
      material_name: session.setTitle,
      source_anchor: session.sourceAnchor,
      part: session.part,
      skill_tag: skillTag,
      topic: `${session.setTitle} RC 문제 풀이`,
      question_count: answeredCount,
      correct_count: correctCount,
      accuracy,
      time_pressure: 'none',
      next_action:
        wrongCount > 0 ? `오답 ${wrongCount}문항 검토` : '정답 문항 복습 유지',
      attempt_id: attemptId,
      origin: 'rc-practice',
      source_set_id: session.setId,
      source_kind: session.sourceKind,
      answered_question_nos: session.answers.map((answer) => answer.questionNo),
      wrong_question_nos: session.answers
        .filter((answer) => answer.result === 'wrong')
        .map((answer) => answer.questionNo),
    },
  })

  const answerEvents = answeredItems.map((item) => {
    const answer = answersByKey.get(item.key)
    if (!answer) {
      return null
    }

    return createBaseEvent(sync, {
      event_type: session.sourceKind === 'official' ? 'rc_item.answered' : 'drill_item.answered',
      entity_type: 'practice_item',
      entity_id: item.itemId,
      session_id: session.sessionId,
      attempt_id: attemptId,
      timestamp: session.completedAt,
      payload: {
        source_set_id: item.sourceSetId,
        source_kind: item.sourceKind,
        question_no: item.questionNo,
        question_type: item.questionType,
        skill_tag: item.skillTag,
        vocab_domain: item.vocabDomain,
        document_genre: item.documentGenre,
        selected_answer: answer.selectedAnswer,
        correct_answer: item.correctAnswer,
        result: answer.result,
        error_type: 'mixed',
        time_pressure: 'none',
        note: '',
        attempt_id: attemptId,
        item_id: item.itemId,
      },
    })
  }).filter((event): event is ToeicWebSyncEvent => Boolean(event))

  return {
    nextSync: finalizeSync(sync, [attemptEvent, ...answerEvents]),
    summary: {
      attemptId,
      answeredCount,
      correctCount,
      wrongCount,
      title: session.setTitle,
    } satisfies PracticeCompletionSummary,
  }
}

export function appendPracticeNote(
  sync: ToeicWebSyncV1,
  record: Pick<PracticeRecordView, 'attemptId' | 'noteEventId'>,
  content: string,
) {
  const noteId = createId('note')
  const event = createBaseEvent(sync, {
    event_type: 'study_note.recorded',
    entity_type: 'practice_attempt_note',
    entity_id: noteId,
    session_id: `practice-note-${record.attemptId}`,
    attempt_id: record.attemptId,
    supersedes_event_id: record.noteEventId,
    payload: {
      note_id: noteId,
      target_type: 'practice_attempt',
      target_attempt_id: record.attemptId,
      content,
    },
  })

  return finalizeSync(sync, [event])
}
