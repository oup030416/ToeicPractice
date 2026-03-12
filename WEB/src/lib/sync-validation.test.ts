import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { safeParseToeicWebSyncText, type ToeicWebSyncV1 } from './sync-schema'
import { validateToeicWebSync } from './sync-validation'

function loadSampleText() {
  return readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8')
}

function loadSampleData() {
  const rawText = loadSampleText()
  const parsed = safeParseToeicWebSyncText(rawText)

  if (!parsed.success) {
    throw new Error(parsed.message)
  }

  return {
    rawText,
    syncData: parsed.data,
  }
}

function buildOfficialSet() {
  return {
    set_id: 'official-001',
    title: '공식 세트 1',
    source_anchor: 'anchor-1',
    source_type: 'official' as const,
    region: 'KR' as const,
    part: 'Part 5' as const,
    document_genre: 'email',
    passages: [],
    items: [
      {
        item_id: 'item-1',
        question_no: 1,
        part: 'Part 5' as const,
        question_type: 'parts of speech',
        skill_tag: 'grammar reaction',
        vocab_domain: 'general business',
        document_genre: 'email',
        stem: 'Choose the best answer.',
        choices: [
          { key: 'A', text: 'option A' },
          { key: 'B', text: 'option B' },
          { key: 'C', text: 'option C' },
          { key: 'D', text: 'option D' },
        ],
        correct_answer: 'B',
      },
    ],
    imported_at: '2026-03-12T12:00:00+09:00',
    notes: null,
  }
}

function buildAnsweredPayload() {
  return {
    source_set_id: 'official-001',
    source_kind: 'official' as const,
    question_no: 1,
    question_type: 'parts of speech',
    skill_tag: 'grammar reaction',
    vocab_domain: 'general business',
    document_genre: 'email',
    selected_answer: 'A',
    correct_answer: 'B',
    result: 'wrong' as const,
    error_type: 'grammar' as const,
    time_pressure: 'weak' as const,
    note: '',
    item_id: 'item-1',
    attempt_id: 'attempt-1',
  }
}

function buildAnsweredEvent(overrides: Partial<ToeicWebSyncV1['events'][number]> = {}) {
  return {
    event_id: 'web-20260312-0100',
    timestamp: '2026-03-12T13:00:00+09:00',
    actor: 'web' as const,
    event_type: 'rc_item.answered',
    entity_type: 'rc_item',
    entity_id: 'official-001-q1',
    session_id: 'session-1',
    attempt_id: 'attempt-1',
    payload: buildAnsweredPayload(),
    supersedes_event_id: null,
    ...overrides,
  }
}

describe('validateToeicWebSync', () => {
  it('passes the current sample without errors or warnings', () => {
    const { rawText, syncData } = loadSampleData()
    const validation = validateToeicWebSync(syncData, rawText)

    expect(validation.errors).toHaveLength(0)
    expect(validation.warnings).toHaveLength(0)
  })

  it('blocks duplicate event_id values', () => {
    const { rawText, syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      events: [...syncData.events, { ...syncData.events[0] }],
    }

    const validation = validateToeicWebSync(invalid, rawText)

    expect(validation.errors.some((issue) => issue.code === 'duplicate-event-id')).toBe(
      true,
    )
  })

  it('blocks invalid actor and event ownership combinations', () => {
    const { rawText, syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      events: [
        {
          ...syncData.events[0],
          actor: 'web' as const,
        },
        ...syncData.events.slice(1),
      ],
    }

    const validation = validateToeicWebSync(invalid, rawText)

    expect(validation.errors.some((issue) => issue.code === 'event-ownership')).toBe(
      true,
    )
  })

  it('blocks source_set_id values that do not exist in materials', () => {
    const { syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        event_count: syncData.meta.event_count + 2,
      },
      materials: {
        ...syncData.materials,
        official_sets: [buildOfficialSet()],
      },
      events: [
        ...syncData.events,
        {
          event_id: 'web-20260312-attempt',
          timestamp: '2026-03-12T12:50:00+09:00',
          actor: 'web' as const,
          event_type: 'attempt.recorded',
          entity_type: 'practice_attempt',
          entity_id: 'attempt-1',
          session_id: 'session-1',
          attempt_id: 'attempt-1',
          payload: {
            material_name: '공식 세트 1',
            source_anchor: 'anchor-1',
            part: 'Part 5' as const,
            skill_tag: 'grammar reaction',
            topic: 'rc practice',
            question_count: 1,
            correct_count: 0,
            accuracy: 0,
            time_pressure: 'none' as const,
            next_action: 'review',
            attempt_id: 'attempt-1',
            origin: 'rc-practice' as const,
            source_set_id: 'official-001',
            source_kind: 'official' as const,
            answered_question_nos: [1],
            wrong_question_nos: [1],
          },
          supersedes_event_id: null,
        },
        buildAnsweredEvent({
          payload: {
            ...buildAnsweredPayload(),
            source_set_id: 'official-999',
          },
        }),
      ],
    }

    const validation = validateToeicWebSync(invalid, JSON.stringify(invalid, null, 2))

    expect(validation.errors.some((issue) => issue.code === 'missing-source-set')).toBe(
      true,
    )
  })

  it('blocks lookup values used outside of lookups lists', () => {
    const { syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        event_count: syncData.meta.event_count + 2,
      },
      materials: {
        ...syncData.materials,
        official_sets: [buildOfficialSet()],
      },
      events: [
        ...syncData.events,
        {
          event_id: 'web-20260312-attempt',
          timestamp: '2026-03-12T12:50:00+09:00',
          actor: 'web' as const,
          event_type: 'attempt.recorded',
          entity_type: 'practice_attempt',
          entity_id: 'attempt-1',
          session_id: 'session-1',
          attempt_id: 'attempt-1',
          payload: {
            material_name: '공식 세트 1',
            source_anchor: 'anchor-1',
            part: 'Part 5' as const,
            skill_tag: 'grammar reaction',
            topic: 'rc practice',
            question_count: 1,
            correct_count: 0,
            accuracy: 0,
            time_pressure: 'none' as const,
            next_action: 'review',
            attempt_id: 'attempt-1',
            origin: 'rc-practice' as const,
            source_set_id: 'official-001',
            source_kind: 'official' as const,
            answered_question_nos: [1],
            wrong_question_nos: [1],
          },
          supersedes_event_id: null,
        },
        buildAnsweredEvent({
          payload: {
            ...buildAnsweredPayload(),
            question_type: 'unknown-question-type',
          },
        }),
      ],
    }

    const validation = validateToeicWebSync(invalid, JSON.stringify(invalid, null, 2))

    expect(validation.errors.some((issue) => issue.code === 'lookup-question-type')).toBe(
      true,
    )
  })

  it('warns when meta.event_count does not match the actual event count', () => {
    const { rawText, syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        event_count: syncData.meta.event_count + 2,
      },
    }

    const validation = validateToeicWebSync(invalid, rawText)

    expect(
      validation.warnings.some((issue) => issue.code === 'event-count-mismatch'),
    ).toBe(true)
  })

  it('warns when unknown future event types exist', () => {
    const { syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        event_count: syncData.meta.event_count + 1,
      },
      events: [
        ...syncData.events,
        {
          event_id: 'web-20260312-9999',
          timestamp: '2026-03-12T13:00:00+09:00',
          actor: 'web' as const,
          event_type: 'future.event',
          entity_type: 'future_entity',
          entity_id: 'future-entity-1',
          session_id: 'unknown',
          attempt_id: 'unknown',
          payload: { note: 'future payload' },
          supersedes_event_id: null,
        },
      ],
    }

    const validation = validateToeicWebSync(invalid, JSON.stringify(invalid, null, 2))

    expect(validation.hasUnknownEvent).toBe(true)
    expect(validation.warnings.some((issue) => issue.code === 'unknown-event-type')).toBe(
      true,
    )
  })

  it('warns when previous_revision is older than the last accepted revision', () => {
    const { rawText, syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        revision: 2,
        previous_revision: 0,
      },
    }

    const validation = validateToeicWebSync(invalid, rawText)

    expect(validation.isStale).toBe(true)
    expect(validation.warnings.some((issue) => issue.code === 'stale-revision')).toBe(
      true,
    )
  })

  it('warns when raw events are newer than dashboard or recommendation snapshots', () => {
    const { syncData } = loadSampleData()
    const invalid = {
      ...syncData,
      meta: {
        ...syncData.meta,
        event_count: syncData.meta.event_count + 1,
      },
      events: [
        ...syncData.events,
        {
          event_id: 'web-20260312-0200',
          timestamp: '2026-03-12T13:30:00+09:00',
          actor: 'web' as const,
          event_type: 'session.recorded',
          entity_type: 'study_session',
          entity_id: 'session-1',
          session_id: 'session-1',
          attempt_id: 'unknown',
          payload: { note: 'raw event' },
          supersedes_event_id: null,
        },
      ],
    }

    const validation = validateToeicWebSync(invalid, JSON.stringify(invalid, null, 2))

    expect(validation.warnings.some((issue) => issue.code === 'stale-dashboard')).toBe(
      true,
    )
    expect(
      validation.warnings.some((issue) => issue.code === 'stale-recommendation'),
    ).toBe(true)
  })
})
