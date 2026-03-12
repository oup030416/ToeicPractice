import {
  answeredPayloadSchema,
  attemptPayloadSchema,
  KNOWN_CODEX_EVENT_TYPES,
  KNOWN_EVENT_TYPES,
  KNOWN_WEB_EVENT_TYPES,
  rawRecordCorrectedPayloadSchema,
  studyNotePayloadSchema,
  syncAcceptedPayloadSchema,
  type RcQuestionItemV1,
  type ToeicWebSyncV1,
} from './sync-schema'

export interface SyncValidationIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  path?: string
  eventId?: string
}

export interface SyncValidationReport {
  errors: SyncValidationIssue[]
  warnings: SyncValidationIssue[]
  isStale: boolean
  hasUnknownEvent: boolean
  exceedsSoftLimit: boolean
  fileSizeBytes: number
  eventCount: number
  unknownEventTypes: string[]
}

const SOFT_LIMIT_BYTES = 5 * 1024 * 1024
const SOFT_LIMIT_EVENTS = 1500

function createIssue(
  level: SyncValidationIssue['level'],
  code: string,
  message: string,
  options: Pick<SyncValidationIssue, 'path' | 'eventId'> = {},
): SyncValidationIssue {
  return {
    level,
    code,
    message,
    ...options,
  }
}

function formatByteSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)}KB`
  }

  return `${bytes}B`
}

function toTimestamp(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function buildItemIndexes(sync: ToeicWebSyncV1) {
  const sourceSetIds = new Set<string>()
  const itemIdMap = new Map<string, Set<string>>()
  const questionNoMap = new Map<string, Set<number>>()

  const registerSet = (setId: string, items: RcQuestionItemV1[]) => {
    sourceSetIds.add(setId)
    itemIdMap.set(
      setId,
      new Set(items.map((item) => item.item_id)),
    )
    questionNoMap.set(
      setId,
      new Set(items.map((item) => item.question_no)),
    )
  }

  for (const set of sync.materials.official_sets) {
    registerSet(set.set_id, set.items)
  }

  for (const set of sync.materials.drill_sets) {
    registerSet(set.set_id, set.items)
  }

  return {
    sourceSetIds,
    itemIdMap,
    questionNoMap,
  }
}

export function validateToeicWebSync(
  sync: ToeicWebSyncV1,
  rawText: string,
): SyncValidationReport {
  const errors: SyncValidationIssue[] = []
  const warnings: SyncValidationIssue[] = []

  const fileSizeBytes = new TextEncoder().encode(rawText).length
  const eventIdSet = new Set<string>()
  const attemptIdSet = new Set<string>()
  const {
    sourceSetIds,
    itemIdMap,
    questionNoMap,
  } = buildItemIndexes(sync)

  const allQuestionTypes = new Set(
    Object.values(sync.lookups.question_types).flat(),
  )
  const vocabDomains = new Set(sync.lookups.vocab_domains)
  const documentGenres = new Set(sync.lookups.document_genres)
  const errorTypes = new Set(sync.lookups.error_types)
  const webEventTypeSet = new Set<string>(KNOWN_WEB_EVENT_TYPES)
  const codexEventTypeSet = new Set<string>(KNOWN_CODEX_EVENT_TYPES)
  const knownEventTypeSet = new Set<string>(KNOWN_EVENT_TYPES)

  for (const event of sync.events) {
    if (eventIdSet.has(event.event_id)) {
      errors.push(
        createIssue(
          'error',
          'duplicate-event-id',
          `event_id가 중복됩니다: ${event.event_id}`,
          { path: 'events.event_id', eventId: event.event_id },
        ),
      )
      continue
    }

    eventIdSet.add(event.event_id)

    const parsedAttempt = attemptPayloadSchema.safeParse(event.payload)
    if (event.event_type === 'attempt.recorded' && parsedAttempt.success) {
      const payloadAttemptId = parsedAttempt.data.attempt_id ?? event.attempt_id
      if (payloadAttemptId) {
        attemptIdSet.add(payloadAttemptId)
      }
    }
  }

  for (const event of sync.events) {
    const expectedActor = webEventTypeSet.has(event.event_type)
      ? 'web'
      : codexEventTypeSet.has(event.event_type)
        ? 'codex'
        : null

    if (expectedActor && event.actor !== expectedActor) {
      errors.push(
        createIssue(
          'error',
          'event-ownership',
          `${event.event_type}는 ${expectedActor}만 기록할 수 있습니다.`,
          { path: 'events.actor', eventId: event.event_id },
        ),
      )
    }

    if (event.supersedes_event_id && !eventIdSet.has(event.supersedes_event_id)) {
      errors.push(
        createIssue(
          'error',
          'missing-supersedes-target',
          `supersedes_event_id 대상 이벤트가 현재 파일에 없습니다: ${event.supersedes_event_id}`,
          { path: 'events.supersedes_event_id', eventId: event.event_id },
        ),
      )
    }

    if (event.event_type === 'attempt.recorded') {
      const parsedAttempt = attemptPayloadSchema.safeParse(event.payload)

      if (!parsedAttempt.success) {
        continue
      }

      const payload = parsedAttempt.data

      if (payload.origin === 'rc-practice') {
        if (!payload.attempt_id) {
          errors.push(
            createIssue(
              'error',
              'practice-attempt-id',
              'RC 풀이 기록에는 payload.attempt_id가 필요합니다.',
              { path: 'events.payload.attempt_id', eventId: event.event_id },
            ),
          )
        }

        if (!payload.source_set_id || !sourceSetIds.has(payload.source_set_id)) {
          errors.push(
            createIssue(
              'error',
              'practice-attempt-source-set',
              'RC 풀이 기록의 source_set_id가 materials에 없습니다.',
              { path: 'events.payload.source_set_id', eventId: event.event_id },
            ),
          )
        }

        if (!payload.source_kind) {
          errors.push(
            createIssue(
              'error',
              'practice-attempt-source-kind',
              'RC 풀이 기록에는 payload.source_kind가 필요합니다.',
              { path: 'events.payload.source_kind', eventId: event.event_id },
            ),
          )
        }

        if (!payload.answered_question_nos) {
          errors.push(
            createIssue(
              'error',
              'practice-attempt-answered-nos',
              'RC 풀이 기록에는 answered_question_nos가 필요합니다.',
              { path: 'events.payload.answered_question_nos', eventId: event.event_id },
            ),
          )
        }

        if (!payload.wrong_question_nos) {
          errors.push(
            createIssue(
              'error',
              'practice-attempt-wrong-nos',
              'RC 풀이 기록에는 wrong_question_nos가 필요합니다.',
              { path: 'events.payload.wrong_question_nos', eventId: event.event_id },
            ),
          )
        }
      }
    }

    if (
      event.event_type === 'rc_item.answered' ||
      event.event_type === 'drill_item.answered'
    ) {
      const parsedAnswered = answeredPayloadSchema.safeParse(event.payload)

      if (!parsedAnswered.success) {
        continue
      }

      const payload = parsedAnswered.data

      if (!sourceSetIds.has(payload.source_set_id)) {
        errors.push(
          createIssue(
            'error',
            'missing-source-set',
            `payload.source_set_id가 materials 세트에 없습니다: ${payload.source_set_id}`,
            { path: 'events.payload.source_set_id', eventId: event.event_id },
          ),
        )
      }

      if (payload.item_id) {
        if (!itemIdMap.get(payload.source_set_id)?.has(payload.item_id)) {
          errors.push(
            createIssue(
              'error',
              'missing-source-item',
              `payload.item_id가 source_set_id 세트에 없습니다: ${payload.item_id}`,
              { path: 'events.payload.item_id', eventId: event.event_id },
            ),
          )
        }
      } else if (!questionNoMap.get(payload.source_set_id)?.has(payload.question_no)) {
        errors.push(
          createIssue(
            'error',
            'missing-source-question-no',
            `payload.question_no가 source_set_id 세트에 없습니다: ${payload.question_no}`,
            { path: 'events.payload.question_no', eventId: event.event_id },
          ),
        )
      }

      if (payload.attempt_id && !attemptIdSet.has(payload.attempt_id)) {
        errors.push(
          createIssue(
            'error',
            'missing-attempt-id',
            `payload.attempt_id 대상 attempt.recorded가 없습니다: ${payload.attempt_id}`,
            { path: 'events.payload.attempt_id', eventId: event.event_id },
          ),
        )
      }

      if (!allQuestionTypes.has(payload.question_type)) {
        errors.push(
          createIssue(
            'error',
            'lookup-question-type',
            `payload.question_type가 lookups.question_types에 없습니다: ${payload.question_type}`,
            { path: 'events.payload.question_type', eventId: event.event_id },
          ),
        )
      }

      if (!vocabDomains.has(payload.vocab_domain)) {
        errors.push(
          createIssue(
            'error',
            'lookup-vocab-domain',
            `payload.vocab_domain이 lookups.vocab_domains에 없습니다: ${payload.vocab_domain}`,
            { path: 'events.payload.vocab_domain', eventId: event.event_id },
          ),
        )
      }

      if (!documentGenres.has(payload.document_genre)) {
        errors.push(
          createIssue(
            'error',
            'lookup-document-genre',
            `payload.document_genre가 lookups.document_genres에 없습니다: ${payload.document_genre}`,
            { path: 'events.payload.document_genre', eventId: event.event_id },
          ),
        )
      }

      if (!errorTypes.has(payload.error_type)) {
        errors.push(
          createIssue(
            'error',
            'lookup-error-type',
            `payload.error_type이 lookups.error_types에 없습니다: ${payload.error_type}`,
            { path: 'events.payload.error_type', eventId: event.event_id },
          ),
        )
      }
    }

    if (event.event_type === 'study_note.recorded') {
      const parsedNote = studyNotePayloadSchema.safeParse(event.payload)

      if (!parsedNote.success) {
        continue
      }

      if (!attemptIdSet.has(parsedNote.data.target_attempt_id)) {
        errors.push(
          createIssue(
            'error',
            'missing-note-target',
            `study_note.recorded 대상 attempt가 없습니다: ${parsedNote.data.target_attempt_id}`,
            { path: 'events.payload.target_attempt_id', eventId: event.event_id },
          ),
        )
      }
    }

    if (event.event_type === 'raw_record.corrected') {
      const parsedCorrection = rawRecordCorrectedPayloadSchema.safeParse(event.payload)

      if (!parsedCorrection.success) {
        continue
      }

      const payload = parsedCorrection.data

      if (!sourceSetIds.has(payload.source_set_id)) {
        errors.push(
          createIssue(
            'error',
            'missing-correction-source-set',
            `raw_record.corrected의 source_set_id가 materials에 없습니다: ${payload.source_set_id}`,
            { path: 'events.payload.source_set_id', eventId: event.event_id },
          ),
        )
      }

      if (!itemIdMap.get(payload.source_set_id)?.has(payload.item_id)) {
        errors.push(
          createIssue(
            'error',
            'missing-correction-item',
            `raw_record.corrected의 item_id가 source_set_id 세트에 없습니다: ${payload.item_id}`,
            { path: 'events.payload.item_id', eventId: event.event_id },
          ),
        )
      }
    }
  }

  if (sync.meta.event_count !== sync.events.length) {
    warnings.push(
      createIssue(
        'warning',
        'event-count-mismatch',
        `meta.event_count(${sync.meta.event_count})와 실제 events.length(${sync.events.length})가 다릅니다.`,
        { path: 'meta.event_count' },
      ),
    )
  }

  const unknownEventTypes = [
    ...new Set(
      sync.events
        .map((event) => event.event_type)
        .filter((eventType) => !knownEventTypeSet.has(eventType)),
    ),
  ].sort((left, right) => left.localeCompare(right, 'ko-KR'))

  if (unknownEventTypes.length > 0) {
    warnings.push(
      createIssue(
        'warning',
        'unknown-event-type',
        `알 수 없는 미래 이벤트 타입이 있습니다: ${unknownEventTypes.join(', ')}`,
        { path: 'events.event_type' },
      ),
    )
  }

  if (fileSizeBytes > SOFT_LIMIT_BYTES) {
    warnings.push(
      createIssue(
        'warning',
        'soft-limit-file-size',
        `파일 크기가 5MB를 초과했습니다. 현재 ${formatByteSize(fileSizeBytes)}입니다.`,
      ),
    )
  }

  if (sync.events.length > SOFT_LIMIT_EVENTS) {
    warnings.push(
      createIssue(
        'warning',
        'soft-limit-event-count',
        `이벤트 수가 1,500개를 초과했습니다. 현재 ${sync.events.length}개입니다.`,
        { path: 'events' },
      ),
    )
  }

  const rawEventTimestamp = sync.events.reduce<number | null>((latest, event) => {
    if (!webEventTypeSet.has(event.event_type)) {
      return latest
    }

    const timestamp = toTimestamp(event.timestamp)

    if (timestamp === null) {
      return latest
    }

    return latest === null || timestamp > latest ? timestamp : latest
  }, null)

  const latestDashboardTimestamp = sync.events.reduce<number | null>((latest, event) => {
    if (event.event_type !== 'dashboard.published') {
      return latest
    }

    const timestamp = toTimestamp(event.timestamp)

    if (timestamp === null) {
      return latest
    }

    return latest === null || timestamp > latest ? timestamp : latest
  }, null)

  const latestRecommendationTimestamp = sync.events.reduce<number | null>(
    (latest, event) => {
      if (event.event_type !== 'recommendation.published') {
        return latest
      }

      const timestamp = toTimestamp(event.timestamp)

      if (timestamp === null) {
        return latest
      }

      return latest === null || timestamp > latest ? timestamp : latest
    },
    null,
  )

  if (
    rawEventTimestamp !== null &&
    (latestDashboardTimestamp === null || latestDashboardTimestamp < rawEventTimestamp)
  ) {
    warnings.push(
      createIssue(
        'warning',
        'stale-dashboard',
        '가장 최근 raw 이벤트 이후 dashboard.published가 갱신되지 않았습니다.',
      ),
    )
  }

  if (
    rawEventTimestamp !== null &&
    (latestRecommendationTimestamp === null ||
      latestRecommendationTimestamp < rawEventTimestamp)
  ) {
    warnings.push(
      createIssue(
        'warning',
        'stale-recommendation',
        '가장 최근 raw 이벤트 이후 recommendation.published가 갱신되지 않았습니다.',
      ),
    )
  }

  const lastAcceptedRevisionBeforeCurrent = sync.events.reduce<number | null>(
    (latest, event) => {
      if (event.event_type !== 'sync.accepted') {
        return latest
      }

      const parsedAccepted = syncAcceptedPayloadSchema.safeParse(event.payload)

      if (!parsedAccepted.success) {
        return latest
      }

      const acceptedRevision = parsedAccepted.data.accepted_revision

      if (acceptedRevision >= sync.meta.revision) {
        return latest
      }

      return latest === null || acceptedRevision > latest
        ? acceptedRevision
        : latest
    },
    null,
  )

  if (
    lastAcceptedRevisionBeforeCurrent !== null &&
    sync.meta.previous_revision < lastAcceptedRevisionBeforeCurrent
  ) {
    warnings.push(
      createIssue(
        'warning',
        'stale-revision',
        `meta.previous_revision(${sync.meta.previous_revision})이 마지막 accepted revision(${lastAcceptedRevisionBeforeCurrent})보다 오래되었습니다.`,
        { path: 'meta.previous_revision' },
      ),
    )
  }

  return {
    errors,
    warnings,
    isStale: warnings.some((issue) => issue.code === 'stale-revision'),
    hasUnknownEvent: unknownEventTypes.length > 0,
    exceedsSoftLimit: warnings.some((issue) =>
      issue.code.startsWith('soft-limit-'),
    ),
    fileSizeBytes,
    eventCount: sync.events.length,
    unknownEventTypes,
  }
}
