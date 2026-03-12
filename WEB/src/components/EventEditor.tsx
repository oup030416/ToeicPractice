import { useEffect, useState } from 'react'

import { deleteValueAtPath, getValueAtPath, setValueAtPath } from '../lib/editor-state'
import { EmptyMessage } from './DashboardBlocks'
import type { CommitMessage } from './detail-editor-types'
import { asArray, asRecord, parseJsonInput, readString } from './editor-utils'
import { EditorSection, Field, JsonArea, SectionActionRow } from './editor-shared'

function buildKnownPayloadDraft(eventType: string, payload: Record<string, unknown>) {
  if (eventType === 'attempt.recorded') {
    return {
      kind: 'attempt' as const,
      fields: {
        material_name: readString(payload.material_name),
        source_anchor: readString(payload.source_anchor),
        part: readString(payload.part),
        skill_tag: readString(payload.skill_tag),
        topic: readString(payload.topic),
        question_count: readString(payload.question_count),
        correct_count: readString(payload.correct_count),
        accuracy: readString(payload.accuracy),
        time_pressure: readString(payload.time_pressure),
        next_action: readString(payload.next_action),
      },
    }
  }

  if (eventType === 'rc_item.answered' || eventType === 'drill_item.answered') {
    return {
      kind: 'answered' as const,
      fields: {
        source_set_id: readString(payload.source_set_id),
        source_kind: readString(payload.source_kind),
        question_no: readString(payload.question_no),
        question_type: readString(payload.question_type),
        skill_tag: readString(payload.skill_tag),
        vocab_domain: readString(payload.vocab_domain),
        document_genre: readString(payload.document_genre),
        selected_answer: readString(payload.selected_answer),
        correct_answer: readString(payload.correct_answer),
        result: readString(payload.result),
        error_type: readString(payload.error_type),
        time_pressure: readString(payload.time_pressure),
        note: readString(payload.note),
      },
    }
  }

  if (eventType === 'sync.accepted') {
    return {
      kind: 'sync.accepted' as const,
      fields: {
        accepted_revision: readString(payload.accepted_revision),
        reason: readString(payload.reason),
      },
    }
  }

  if (eventType === 'rc_weakness.recomputed') {
    return {
      kind: 'rc_weakness.recomputed' as const,
      fields: {
        registry: JSON.stringify(payload.registry ?? [], null, 2),
      },
    }
  }

  if (eventType === 'recommendation.published') {
    return {
      kind: 'recommendation.published' as const,
      fields: {
        recommendations: JSON.stringify(payload.recommendations ?? [], null, 2),
      },
    }
  }

  if (eventType === 'dashboard.published') {
    return {
      kind: 'dashboard.published' as const,
      fields: {
        project_status: readString(payload.project_status),
        recent_session: readString(payload.recent_session),
        recent_attempt: readString(payload.recent_attempt),
        rc_focus: JSON.stringify(payload.rc_focus ?? [], null, 2),
        repeated_confusions: JSON.stringify(payload.repeated_confusions ?? [], null, 2),
        recent_improvement_signals: JSON.stringify(
          payload.recent_improvement_signals ?? [],
          null,
          2,
        ),
      },
    }
  }

  return {
    kind: 'unknown' as const,
    fields: {
      payload: JSON.stringify(payload, null, 2),
    },
  }
}

export function EventEditor({
  draft,
  eventId,
  onCommitDraftChange,
}: {
  draft: unknown
  eventId: string
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  const events = asArray(getValueAtPath(draft, ['events']))
  const eventIndex = events.findIndex(
    (event) => readString(asRecord(event).event_id) === eventId,
  )

  if (eventIndex === -1) {
    return <EmptyMessage text="현재 드래프트에서 해당 이벤트를 찾지 못했습니다." />
  }

  const eventRecord = asRecord(events[eventIndex])
  const [eventForm, setEventForm] = useState({
    event_id: readString(eventRecord.event_id),
    timestamp: readString(eventRecord.timestamp),
    actor: readString(eventRecord.actor),
    event_type: readString(eventRecord.event_type),
    entity_type: readString(eventRecord.entity_type),
    entity_id: readString(eventRecord.entity_id),
    session_id: readString(eventRecord.session_id),
    attempt_id: readString(eventRecord.attempt_id),
    supersedes_event_id: readString(eventRecord.supersedes_event_id),
  })
  const [payloadDraft, setPayloadDraft] = useState(
    buildKnownPayloadDraft(readString(eventRecord.event_type), asRecord(eventRecord.payload)),
  )
  const [payloadError, setPayloadError] = useState<string | null>(null)

  useEffect(() => {
    setEventForm({
      event_id: readString(eventRecord.event_id),
      timestamp: readString(eventRecord.timestamp),
      actor: readString(eventRecord.actor),
      event_type: readString(eventRecord.event_type),
      entity_type: readString(eventRecord.entity_type),
      entity_id: readString(eventRecord.entity_id),
      session_id: readString(eventRecord.session_id),
      attempt_id: readString(eventRecord.attempt_id),
      supersedes_event_id: readString(eventRecord.supersedes_event_id),
    })
    setPayloadDraft(
      buildKnownPayloadDraft(readString(eventRecord.event_type), asRecord(eventRecord.payload)),
    )
    setPayloadError(null)
  }, [JSON.stringify(eventRecord)])

  function handleApply() {
    let nextEvent: unknown = eventRecord

    for (const [key, value] of Object.entries(eventForm)) {
      if (!value.trim()) {
        nextEvent = deleteValueAtPath(nextEvent, [key])
        continue
      }

      nextEvent = setValueAtPath(nextEvent, [key], value.trim())
    }

    let nextPayload: unknown = {}

    if (payloadDraft.kind === 'attempt') {
      for (const [key, value] of Object.entries(payloadDraft.fields)) {
        const normalized = ['question_count', 'correct_count', 'accuracy'].includes(key)
          ? Number(value)
          : value
        nextPayload = setValueAtPath(nextPayload, [key], normalized)
      }
    } else if (payloadDraft.kind === 'answered') {
      for (const [key, value] of Object.entries(payloadDraft.fields)) {
        const normalized = key === 'question_no' ? Number(value) : value
        nextPayload = setValueAtPath(nextPayload, [key], normalized)
      }
    } else if (payloadDraft.kind === 'sync.accepted') {
      nextPayload = {
        accepted_revision: Number(payloadDraft.fields.accepted_revision),
        reason: payloadDraft.fields.reason,
      }
    } else {
      for (const [key, value] of Object.entries(payloadDraft.fields)) {
        if (
          key === 'project_status' ||
          key === 'recent_session' ||
          key === 'recent_attempt'
        ) {
          nextPayload = setValueAtPath(nextPayload, [key], value)
          continue
        }

        const parsed = parseJsonInput(value)

        if (!parsed.success) {
          setPayloadError(`${key} JSON 문법이 올바르지 않습니다.`)
          return
        }

        if (payloadDraft.kind === 'unknown' && key === 'payload') {
          nextPayload = parsed.value
          continue
        }

        nextPayload = setValueAtPath(nextPayload, [key], parsed.value)
      }
    }

    setPayloadError(null)
    nextEvent = setValueAtPath(nextEvent, ['payload'], nextPayload)

    onCommitDraftChange(setValueAtPath(draft, ['events', eventIndex], nextEvent), {
      title: '이벤트를 적용했습니다.',
      description: '선택한 이벤트 변경을 드래프트에 반영했습니다.',
      nextPanel: { type: 'event', eventId: eventForm.event_id || eventId },
    })
  }

  function handleDelete() {
    onCommitDraftChange(deleteValueAtPath(draft, ['events', eventIndex]), {
      actionType: 'delete_node',
      title: '이벤트를 삭제했습니다.',
      description: '선택한 이벤트를 드래프트에서 제거했습니다.',
      nextPanel: { type: 'events' },
    })
  }

  return (
    <div className="space-y-5">
      <EditorSection title="이벤트 메타 편집">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(eventForm).map(([key, value]) => (
            <Field
              key={key}
              label={key}
              onChange={(nextValue) =>
                setEventForm((current) => ({ ...current, [key]: nextValue }))
              }
              value={value}
            />
          ))}
        </div>
      </EditorSection>

      <EditorSection title="payload 편집">
        <div className="space-y-4">
          {Object.entries(payloadDraft.fields).map(([key, value]) =>
            key === 'registry' ||
            key === 'recommendations' ||
            key === 'rc_focus' ||
            key === 'repeated_confusions' ||
            key === 'recent_improvement_signals' ||
            key === 'payload' ? (
              <JsonArea
                key={key}
                label={key}
                onChange={(nextValue) =>
                  setPayloadDraft((current) => ({
                    ...current,
                    fields: { ...current.fields, [key]: nextValue },
                  }))
                }
                value={value}
              />
            ) : (
              <Field
                key={key}
                label={key}
                onChange={(nextValue) =>
                  setPayloadDraft((current) => ({
                    ...current,
                    fields: { ...current.fields, [key]: nextValue },
                  }))
                }
                value={value}
              />
            ),
          )}
        </div>
        {payloadError ? <p className="text-sm text-rose-700">{payloadError}</p> : null}
        <SectionActionRow
          dangerLabel="이 이벤트 삭제"
          onDanger={handleDelete}
          onPrimary={handleApply}
          primaryLabel="이벤트 적용"
        />
      </EditorSection>
    </div>
  )
}
