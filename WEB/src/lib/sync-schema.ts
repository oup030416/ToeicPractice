import { z } from 'zod'

export const RC_PART_VALUES = ['Part 5', 'Part 6', 'Part 7'] as const
export const ACTOR_VALUES = ['web', 'codex'] as const
export const SOURCE_KIND_VALUES = ['official', 'drill'] as const
export const RESULT_VALUES = ['correct', 'wrong', 'uncertain'] as const
export const TIME_PRESSURE_VALUES = ['none', 'weak', 'strong'] as const
export const ERROR_TYPE_VALUES = [
  'grammar',
  'vocabulary',
  'paraphrase',
  'connect-info',
  'inference',
  'evidence-location',
  'time-pressure',
  'mixed',
] as const
export const REVIEW_STATE_VALUES = [
  'new',
  'reviewed',
  'repeated',
  'stabilized',
] as const
export const RECOMMENDATION_STRENGTH_VALUES = [
  'low',
  'medium',
  'high',
  'critical',
] as const

export const KNOWN_WEB_EVENT_TYPES = [
  'session.recorded',
  'attempt.recorded',
  'study_note.recorded',
  'rc_item.answered',
  'drill_item.answered',
  'raw_record.corrected',
] as const

export const KNOWN_CODEX_EVENT_TYPES = [
  'qna.linked',
  'concept.promoted',
  'review.enqueued',
  'rc_weakness.recomputed',
  'recommendation.published',
  'dashboard.published',
  'drill_set.published',
  'sync.accepted',
] as const

export const KNOWN_EVENT_TYPES = [
  ...KNOWN_WEB_EVENT_TYPES,
  ...KNOWN_CODEX_EVENT_TYPES,
] as const

const partSchema = z.enum(RC_PART_VALUES)
const actorSchema = z.enum(ACTOR_VALUES)
const sourceKindSchema = z.enum(SOURCE_KIND_VALUES)
const resultSchema = z.enum(RESULT_VALUES)
const timePressureSchema = z.enum(TIME_PRESSURE_VALUES)
const errorTypeSchema = z.enum(ERROR_TYPE_VALUES)
const reviewStateSchema = z.enum(REVIEW_STATE_VALUES)
const recommendationStrengthSchema = z.enum(RECOMMENDATION_STRENGTH_VALUES)

const metaSchema = z
  .object({
    workspace_id: z.string(),
    schema_version: z.literal('toeic-web-sync/v1'),
    scope: z.literal('rc'),
    revision: z.number(),
    previous_revision: z.number(),
    exported_at: z.string(),
    exported_by: actorSchema,
    event_count: z.number(),
    materials_revision: z.number(),
  })
  .passthrough()

const questionTypesSchema = z
  .object({
    'Part 5': z.array(z.string()),
    'Part 6': z.array(z.string()),
    'Part 7': z.array(z.string()),
  })
  .strict()

const lookupsSchema = z
  .object({
    parts: z.array(partSchema),
    question_types: questionTypesSchema,
    skill_tags: z.array(z.string()),
    vocab_domains: z.array(z.string()),
    document_genres: z.array(z.string()),
    error_types: z.array(errorTypeSchema),
    review_states: z.array(reviewStateSchema),
    recommendation_strengths: z.array(recommendationStrengthSchema),
  })
  .passthrough()

const officialSetSchema = z
  .object({
    set_id: z.string(),
    title: z.string(),
    source_anchor: z.string(),
    source_type: z.literal('official'),
    region: z.literal('KR'),
    part: partSchema,
    document_genre: z.string(),
    passages: z.array(z.unknown()),
    items: z.array(z.unknown()),
    imported_at: z.string(),
    notes: z.union([z.string(), z.null()]).optional(),
  })
  .passthrough()

const drillSetSchema = z
  .object({
    set_id: z.string(),
    title: z.string(),
    source_anchor: z.string(),
    generation_mode: z.string(),
    target_part: partSchema,
    target_skill: z.string(),
    difficulty: z.string(),
    items: z.array(z.unknown()),
    answer_key: z.unknown(),
    rationale: z.unknown(),
    review_status: reviewStateSchema,
    published_at: z.string(),
  })
  .passthrough()

const materialsSchema = z
  .object({
    official_sets: z.array(officialSetSchema),
    drill_sets: z.array(drillSetSchema),
  })
  .passthrough()

const weaknessRegistryItemSchema = z.object({
  part: partSchema,
  skill_tag: z.string(),
  vocab_domain: z.string(),
  attempt_count: z.number(),
  wrong_count: z.number(),
  accuracy: z.number(),
  repeat_confusion_count: z.number(),
  latest_exposure: z.union([z.string(), z.null()]),
  priority_score: z.number(),
  status: z.string(),
})

export const weaknessPayloadSchema = z.object({
  registry: z.array(weaknessRegistryItemSchema),
})

export const recommendationPayloadSchema = z.object({
  recommendations: z.array(
    z.object({
      slot: z.string(),
      what: z.string(),
      why: z.string(),
      evidence: z.string(),
      strength: recommendationStrengthSchema,
    }),
  ),
})

export const dashboardPayloadSchema = z.object({
  project_status: z.string(),
  recent_session: z.string(),
  recent_attempt: z.string(),
  rc_focus: z.array(
    z.object({
      part: partSchema,
      status: z.string(),
      reason: z.string(),
      strength: recommendationStrengthSchema,
    }),
  ),
  repeated_confusions: z.array(z.unknown()),
  recent_improvement_signals: z.array(z.unknown()),
})

export const syncAcceptedPayloadSchema = z.object({
  accepted_revision: z.number(),
  reason: z.string(),
})

export const attemptPayloadSchema = z.object({
  material_name: z.string(),
  source_anchor: z.string(),
  part: partSchema,
  skill_tag: z.string(),
  topic: z.string(),
  question_count: z.number(),
  correct_count: z.number(),
  accuracy: z.number(),
  time_pressure: timePressureSchema,
  next_action: z.string(),
})

export const answeredPayloadSchema = z.object({
  source_set_id: z.string(),
  source_kind: sourceKindSchema,
  question_no: z.number(),
  question_type: z.string(),
  skill_tag: z.string(),
  vocab_domain: z.string(),
  document_genre: z.string(),
  selected_answer: z.string(),
  correct_answer: z.string(),
  result: resultSchema,
  error_type: errorTypeSchema,
  time_pressure: timePressureSchema,
  note: z.string(),
})

const knownPayloadSchemas: Record<string, z.ZodTypeAny> = {
  'attempt.recorded': attemptPayloadSchema,
  'rc_item.answered': answeredPayloadSchema,
  'drill_item.answered': answeredPayloadSchema,
  'rc_weakness.recomputed': weaknessPayloadSchema,
  'recommendation.published': recommendationPayloadSchema,
  'dashboard.published': dashboardPayloadSchema,
  'sync.accepted': syncAcceptedPayloadSchema,
}

function describeIssue(issue: z.core.$ZodIssue) {
  if (issue.code === 'invalid_value' && 'values' in issue) {
    return `허용된 값만 사용할 수 있습니다. (${issue.values.join(', ')})`
  }

  if (issue.code === 'invalid_type') {
    return '필수 값이 없거나 형식이 올바르지 않습니다.'
  }

  if (issue.code === 'unrecognized_keys') {
    return '허용되지 않은 키가 포함되어 있습니다.'
  }

  if (issue.code === 'too_small') {
    return '필수 값이 비어 있습니다.'
  }

  return issue.message || '스키마 검증에 실패했습니다.'
}

const eventSchema = z
  .object({
    event_id: z.string(),
    timestamp: z.string(),
    actor: actorSchema,
    event_type: z.string(),
    entity_type: z.string(),
    entity_id: z.string(),
    session_id: z.string(),
    attempt_id: z.string(),
    payload: z.unknown(),
    supersedes_event_id: z.union([z.string(), z.null()]),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    const payloadSchema = knownPayloadSchemas[value.event_type]

    if (!payloadSchema) {
      return
    }

    const parsed = payloadSchema.safeParse(value.payload)

    if (parsed.success) {
      return
    }

    for (const issue of parsed.error.issues) {
      ctx.addIssue({
        code: 'custom',
        path: ['payload', ...issue.path],
        message: describeIssue(issue),
      })
    }
  })

export const toeicWebSyncSchema = z
  .object({
    meta: metaSchema,
    lookups: lookupsSchema,
    materials: materialsSchema,
    events: z.array(eventSchema),
  })
  .strict()

export type ToeicWebSyncV1 = z.infer<typeof toeicWebSyncSchema>
export type ToeicWebSyncEvent = ToeicWebSyncV1['events'][number]
export type ToeicLookups = ToeicWebSyncV1['lookups']

interface ParseSuccess {
  success: true
  data: ToeicWebSyncV1
}

interface ParseFailure {
  success: false
  message: string
  issues: string[]
}

function formatSchemaIssue(issue: z.core.$ZodIssue) {
  const issuePath = issue.path.length ? issue.path.join('.') : '루트 데이터'
  return `${issuePath}: ${describeIssue(issue)}`
}

export function safeParseToeicWebSync(input: unknown): ParseSuccess | ParseFailure {
  const parsed = toeicWebSyncSchema.safeParse(input)

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    }
  }

  const issues = parsed.error.issues.map(formatSchemaIssue)

  return {
    success: false,
    message: issues[0] ?? '스키마 검증에 실패했습니다.',
    issues,
  }
}

export function safeParseToeicWebSyncText(
  rawText: string,
): ParseSuccess | ParseFailure {
  try {
    const parsed = JSON.parse(rawText) as unknown
    return safeParseToeicWebSync(parsed)
  } catch {
    return {
      success: false,
      message: 'JSON 문법이 올바르지 않습니다.',
      issues: ['JSON 문법이 올바르지 않습니다.'],
    }
  }
}
