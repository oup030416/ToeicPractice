import { z } from 'zod'

const metaSchema = z
  .object({
    workspace_id: z.string(),
    schema_version: z.literal('toeic-web-sync/v1'),
    scope: z.literal('rc'),
    revision: z.number(),
    previous_revision: z.number(),
    exported_at: z.string(),
    exported_by: z.string(),
    event_count: z.number(),
    materials_revision: z.number(),
  })
  .passthrough()

const lookupsSchema = z
  .object({
    parts: z.array(z.string()),
    question_types: z.record(z.string(), z.array(z.string())),
    skill_tags: z.array(z.string()),
    vocab_domains: z.array(z.string()),
    document_genres: z.array(z.string()),
    error_types: z.array(z.string()),
    review_states: z.array(z.string()),
    recommendation_strengths: z.array(z.string()),
  })
  .passthrough()

const officialSetSchema = z
  .object({
    set_id: z.string(),
    title: z.string(),
    source_anchor: z.string(),
    source_type: z.string(),
    region: z.string(),
    part: z.string(),
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
    target_part: z.string(),
    target_skill: z.string(),
    difficulty: z.string(),
    items: z.array(z.unknown()),
    answer_key: z.unknown(),
    rationale: z.unknown(),
    review_status: z.string(),
    published_at: z.string(),
  })
  .passthrough()

const materialsSchema = z
  .object({
    official_sets: z.array(officialSetSchema),
    drill_sets: z.array(drillSetSchema),
  })
  .passthrough()

const eventSchema = z
  .object({
    event_id: z.string(),
    timestamp: z.string(),
    actor: z.string(),
    event_type: z.string(),
    entity_type: z.string(),
    entity_id: z.string(),
    session_id: z.string(),
    attempt_id: z.string(),
    payload: z.unknown(),
    supersedes_event_id: z.union([z.string(), z.null()]),
  })
  .passthrough()

export const toeicWebSyncSchema = z.object({
  meta: metaSchema,
  lookups: lookupsSchema,
  materials: materialsSchema,
  events: z.array(eventSchema),
})

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
}

export function safeParseToeicWebSync(input: unknown): ParseSuccess | ParseFailure {
  const parsed = toeicWebSyncSchema.safeParse(input)

  if (parsed.success) {
    return {
      success: true,
      data: parsed.data,
    }
  }

  const firstIssue = parsed.error.issues[0]
  const issuePath = firstIssue?.path.length
    ? firstIssue.path.join('.')
    : '루트 데이터'

  return {
    success: false,
    message: `${issuePath}: ${firstIssue?.message ?? '스키마 검증에 실패했습니다.'}`,
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
    }
  }
}
