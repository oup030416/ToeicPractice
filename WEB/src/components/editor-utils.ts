import { safePrettyJson } from '../lib/format'
import type { EventCardView } from '../lib/sync-view-model'

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value as Record<string, unknown>
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function readString(value: unknown) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value)
}

export function parseJsonInput(value: string) {
  try {
    return {
      success: true as const,
      value: JSON.parse(value) as unknown,
    }
  } catch {
    return {
      success: false as const,
    }
  }
}

export function buildFallbackEventCards(events: unknown[]): EventCardView[] {
  return events
    .map((event, index) => {
      const record = asRecord(event)
      const eventId = readString(record.event_id)
      const eventType = readString(record.event_type)
      const actor = readString(record.actor) || 'unknown'
      const description = `${readString(record.entity_type)} · ${readString(record.entity_id)}`

      return {
        id: eventId || `fallback-event-${index}`,
        timestamp: readString(record.timestamp),
        actor,
        eventType,
        entityType: readString(record.entity_type),
        entityId: readString(record.entity_id),
        sessionId: readString(record.session_id),
        attemptId: readString(record.attempt_id),
        title: eventType || '이벤트',
        description,
        tone: 'neutral',
        tags: [actor],
        payload: record.payload,
        searchableText: `${safePrettyJson(event)} ${eventType} ${description}`.toLowerCase(),
      } satisfies EventCardView
    })
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
}
