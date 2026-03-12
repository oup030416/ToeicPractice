import { z } from 'zod'

import { formatPercent, safePrettyJson, toKoreanList } from './format'
import {
  attemptPayloadSchema,
  answeredPayloadSchema,
  dashboardPayloadSchema,
  recommendationPayloadSchema,
  syncAcceptedPayloadSchema,
  weaknessPayloadSchema,
  type ToeicLookups,
  type ToeicWebSyncEvent,
  type ToeicWebSyncV1,
} from './sync-schema'
import {
  type SyncValidationReport,
  validateToeicWebSync,
} from './sync-validation'

export type BadgeTone = 'brand' | 'accent' | 'success' | 'danger' | 'neutral'

export interface CountSummary {
  key: string
  count: number
}

export interface RecommendationSummary {
  slot: string
  what: string
  why: string
  evidence: string
  strength: string
}

export interface WeaknessSummary {
  part: string
  skillTag: string
  vocabDomain: string
  accuracy: number
  priorityScore: number
  repeatConfusionCount: number
  status: string
  latestExposure: string | null
}

export interface DashboardFocusSummary {
  part: string
  status: string
  reason: string
  strength: string
}

export interface EventCardView {
  id: string
  timestamp: string
  actor: string
  eventType: string
  entityType: string
  entityId: string
  sessionId: string
  attemptId: string
  title: string
  description: string
  tone: BadgeTone
  tags: string[]
  payload: unknown
  searchableText: string
}

export interface MaterialSummaryCard {
  id: string
  title: string
  part: string
  anchor: string
  sourceLabel: string
  raw: unknown
}

export interface LookupSection {
  title: string
  items: string[]
}

export interface DashboardViewModel {
  meta: ToeicWebSyncV1['meta']
  rawJson: string
  eventCountMatches: boolean
  eventCountDelta: number
  recentSession: string
  recentAttempt: string
  latestRecommendations: RecommendationSummary[]
  dashboardFocus: DashboardFocusSummary[]
  repeatedConfusions: string[]
  recentImprovementSignals: string[]
  latestWeaknesses: WeaknessSummary[]
  topWeaknesses: WeaknessSummary[]
  eventTypeCounts: CountSummary[]
  partCounts: CountSummary[]
  skillCounts: CountSummary[]
  vocabDomainCounts: CountSummary[]
  recommendationStrengthCounts: CountSummary[]
  materialsSummary: {
    officialCount: number
    drillCount: number
    officialCards: MaterialSummaryCard[]
    drillCards: MaterialSummaryCard[]
  }
  lookupSummary: CountSummary[]
  lookupSections: LookupSection[]
  allEvents: EventCardView[]
  recentEvents: EventCardView[]
  lastAcceptedRevision: number | null
  lastAcceptedReason: string | null
  validation: SyncValidationReport
}

function safeParseKnownPayload<T>(schema: z.ZodType<T>, payload: unknown) {
  const parsed = schema.safeParse(payload)
  return parsed.success ? parsed.data : null
}

function incrementCounter(map: Map<string, number>, key: string | null | undefined) {
  if (!key) {
    return
  }

  map.set(key, (map.get(key) ?? 0) + 1)
}

function toSortedCounts(map: Map<string, number>, limit = 6) {
  return [...map.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1]
      }

      return left[0].localeCompare(right[0], 'ko-KR')
    })
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function describeUnknown(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return safePrettyJson(value)
}

function formatResultLabel(value: string) {
  if (value === 'correct') {
    return '정답'
  }

  if (value === 'wrong') {
    return '오답'
  }

  if (value === 'uncertain') {
    return '확신 부족'
  }

  return value
}

function formatStatusLabel(value: string) {
  if (value === 'active') {
    return '활성'
  }

  if (value === 'watch') {
    return '관찰'
  }

  return value
}

function findLatestEvent(events: ToeicWebSyncEvent[], type: string) {
  return [...events]
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .find((event) => event.event_type === type)
}

function buildLookupSections(lookups: ToeicLookups): LookupSection[] {
  return [
    { title: '파트', items: lookups.parts },
    ...lookups.parts.map((part) => ({
      title: `${part} 문제 유형`,
      items: lookups.question_types[part] ?? [],
    })),
    { title: '스킬 태그', items: lookups.skill_tags },
    { title: '어휘 도메인', items: lookups.vocab_domains },
    { title: '문서 장르', items: lookups.document_genres },
    { title: '오답 유형', items: lookups.error_types },
    { title: '복습 상태', items: lookups.review_states },
    { title: '추천 강도', items: lookups.recommendation_strengths },
  ]
}

function buildLookupSummary(lookups: ToeicLookups) {
  return [
    { key: '파트', count: lookups.parts.length },
    {
      key: '문제 유형',
      count: Object.values(lookups.question_types).reduce(
        (sum, items) => sum + items.length,
        0,
      ),
    },
    { key: '스킬 태그', count: lookups.skill_tags.length },
    { key: '어휘 도메인', count: lookups.vocab_domains.length },
    { key: '문서 장르', count: lookups.document_genres.length },
    { key: '오답 유형', count: lookups.error_types.length },
    { key: '복습 상태', count: lookups.review_states.length },
    { key: '추천 강도', count: lookups.recommendation_strengths.length },
  ]
}

function eventTone(eventType: string): BadgeTone {
  if (eventType === 'recommendation.published') {
    return 'brand'
  }

  if (eventType === 'dashboard.published' || eventType === 'sync.accepted') {
    return 'success'
  }

  if (eventType === 'rc_weakness.recomputed' || eventType === 'review.enqueued') {
    return 'accent'
  }

  if (eventType === 'raw_record.corrected') {
    return 'danger'
  }

  return 'neutral'
}

function buildEventCard(event: ToeicWebSyncEvent): EventCardView {
  let title = event.event_type
  let description = `${event.entity_type} · ${event.entity_id}`
  let tags: string[] = [event.actor]

  const weaknessPayload = safeParseKnownPayload(weaknessPayloadSchema, event.payload)
  const recommendationPayload = safeParseKnownPayload(
    recommendationPayloadSchema,
    event.payload,
  )
  const dashboardPayload = safeParseKnownPayload(
    dashboardPayloadSchema,
    event.payload,
  )
  const syncAcceptedPayload = safeParseKnownPayload(
    syncAcceptedPayloadSchema,
    event.payload,
  )
  const attemptPayload = safeParseKnownPayload(attemptPayloadSchema, event.payload)
  const answeredPayload = safeParseKnownPayload(answeredPayloadSchema, event.payload)

  if (weaknessPayload) {
    const activeCount = weaknessPayload.registry.filter(
      (item) => item.status === 'active',
    ).length
    title = 'RC 약점 레지스트리 갱신'
    description = `${weaknessPayload.registry.length}개 항목 · 활성 ${activeCount}개`
    tags = weaknessPayload.registry.slice(0, 3).map((item) => item.part)
  } else if (recommendationPayload) {
    title = '추천 스냅샷 게시'
    description = toKoreanList(
      recommendationPayload.recommendations.map((item) => item.what),
    )
    tags = recommendationPayload.recommendations.map((item) => item.strength)
  } else if (dashboardPayload) {
    title = '대시보드 게시'
    description = dashboardPayload.project_status
    tags = dashboardPayload.rc_focus.map((item) => item.part)
  } else if (syncAcceptedPayload) {
    title = '동기화 승인'
    description = `revision ${syncAcceptedPayload.accepted_revision} · ${syncAcceptedPayload.reason}`
    tags = ['승인']
  } else if (attemptPayload) {
    title = `${attemptPayload.part} 시도 기록`
    description = `${attemptPayload.material_name} · ${formatPercent(attemptPayload.accuracy)}`
    tags = [attemptPayload.skill_tag, attemptPayload.time_pressure]
  } else if (answeredPayload) {
    title = `문항 응답 기록 ${answeredPayload.question_no}번`
    description = `${answeredPayload.question_type} · ${formatResultLabel(answeredPayload.result)}`
    tags = [answeredPayload.skill_tag, answeredPayload.vocab_domain]
  }

  const searchableText = [
    event.event_type,
    event.entity_type,
    event.entity_id,
    title,
    description,
    tags.join(' '),
    safePrettyJson(event.payload),
  ]
    .join(' ')
    .toLowerCase()

  return {
    id: event.event_id,
    timestamp: event.timestamp,
    actor: event.actor,
    eventType: event.event_type,
    entityType: event.entity_type,
    entityId: event.entity_id,
    sessionId: event.session_id,
    attemptId: event.attempt_id,
    title,
    description,
    tone: eventTone(event.event_type),
    tags,
    payload: event.payload,
    searchableText,
  }
}

function summarizeMaterials(sync: ToeicWebSyncV1) {
  return {
    officialCount: sync.materials.official_sets.length,
    drillCount: sync.materials.drill_sets.length,
    officialCards: sync.materials.official_sets.map((set) => ({
      id: set.set_id,
      title: set.title,
      part: set.part,
      anchor: set.source_anchor,
      sourceLabel: `${set.region} · ${set.source_type}`,
      raw: set,
    })),
    drillCards: sync.materials.drill_sets.map((set) => ({
      id: set.set_id,
      title: set.title,
      part: set.target_part,
      anchor: set.source_anchor,
      sourceLabel: `${set.generation_mode} · ${set.review_status}`,
      raw: set,
    })),
  }
}

export function buildDashboardViewModel(
  sync: ToeicWebSyncV1,
  validation: SyncValidationReport = validateToeicWebSync(sync, safePrettyJson(sync)),
): DashboardViewModel {
  const allEvents = [...sync.events]
    .sort(
      (left, right) =>
        new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime(),
    )
    .map(buildEventCard)

  const latestWeaknessEvent = findLatestEvent(sync.events, 'rc_weakness.recomputed')
  const latestRecommendationEvent = findLatestEvent(
    sync.events,
    'recommendation.published',
  )
  const latestDashboardEvent = findLatestEvent(sync.events, 'dashboard.published')
  const latestSyncAcceptedEvent = findLatestEvent(sync.events, 'sync.accepted')

  const latestWeaknessPayload = latestWeaknessEvent
    ? safeParseKnownPayload(weaknessPayloadSchema, latestWeaknessEvent.payload)
    : null
  const latestRecommendationPayload = latestRecommendationEvent
    ? safeParseKnownPayload(
        recommendationPayloadSchema,
        latestRecommendationEvent.payload,
      )
    : null
  const latestDashboardPayload = latestDashboardEvent
    ? safeParseKnownPayload(dashboardPayloadSchema, latestDashboardEvent.payload)
    : null
  const latestSyncAcceptedPayload = latestSyncAcceptedEvent
    ? safeParseKnownPayload(syncAcceptedPayloadSchema, latestSyncAcceptedEvent.payload)
    : null

  const weaknessList =
    latestWeaknessPayload?.registry.map((item) => ({
      part: item.part,
      skillTag: item.skill_tag,
      vocabDomain: item.vocab_domain,
      accuracy: item.accuracy,
      priorityScore: item.priority_score,
      repeatConfusionCount: item.repeat_confusion_count,
      status: formatStatusLabel(item.status),
      latestExposure: item.latest_exposure,
    })) ?? []

  const topWeaknesses = [...weaknessList]
    .sort((left, right) => right.priorityScore - left.priorityScore)
    .slice(0, 5)

  const latestRecommendations =
    latestRecommendationPayload?.recommendations.map((item) => ({
      slot: item.slot,
      what: item.what,
      why: item.why,
      evidence: item.evidence,
      strength: item.strength,
    })) ?? []

  const dashboardFocus =
    latestDashboardPayload?.rc_focus.map((item) => ({
      part: item.part,
      status: item.status,
      reason: item.reason,
      strength: item.strength,
    })) ?? []

  const repeatedConfusions =
    latestDashboardPayload?.repeated_confusions.map(describeUnknown) ?? []
  const recentImprovementSignals =
    latestDashboardPayload?.recent_improvement_signals.map(describeUnknown) ?? []

  const eventTypeMap = new Map<string, number>()
  const partMap = new Map<string, number>()
  const skillMap = new Map<string, number>()
  const vocabDomainMap = new Map<string, number>()
  const recommendationStrengthMap = new Map<string, number>()

  for (const event of sync.events) {
    incrementCounter(eventTypeMap, event.event_type)

    const attemptPayload = safeParseKnownPayload(attemptPayloadSchema, event.payload)
    const answeredPayload = safeParseKnownPayload(answeredPayloadSchema, event.payload)

    if (attemptPayload) {
      incrementCounter(partMap, attemptPayload.part)
      incrementCounter(skillMap, attemptPayload.skill_tag)
    }

    if (answeredPayload) {
      incrementCounter(skillMap, answeredPayload.skill_tag)
      incrementCounter(vocabDomainMap, answeredPayload.vocab_domain)
    }
  }

  for (const weakness of weaknessList) {
    incrementCounter(partMap, weakness.part)
    incrementCounter(skillMap, weakness.skillTag)
    incrementCounter(vocabDomainMap, weakness.vocabDomain)
  }

  for (const recommendation of latestRecommendations) {
    incrementCounter(recommendationStrengthMap, recommendation.strength)
  }

  const materialsSummary = summarizeMaterials(sync)

  return {
    meta: sync.meta,
    rawJson: safePrettyJson(sync),
    eventCountMatches: sync.meta.event_count === sync.events.length,
    eventCountDelta: sync.events.length - sync.meta.event_count,
    recentSession: latestDashboardPayload?.recent_session ?? '없음',
    recentAttempt: latestDashboardPayload?.recent_attempt ?? '없음',
    latestRecommendations,
    dashboardFocus,
    repeatedConfusions,
    recentImprovementSignals,
    latestWeaknesses: weaknessList,
    topWeaknesses,
    eventTypeCounts: toSortedCounts(eventTypeMap),
    partCounts: toSortedCounts(partMap),
    skillCounts: toSortedCounts(skillMap),
    vocabDomainCounts: toSortedCounts(vocabDomainMap),
    recommendationStrengthCounts: toSortedCounts(recommendationStrengthMap, 4),
    materialsSummary,
    lookupSummary: buildLookupSummary(sync.lookups),
    lookupSections: buildLookupSections(sync.lookups),
    allEvents,
    recentEvents: allEvents.slice(0, 6),
    lastAcceptedRevision: latestSyncAcceptedPayload?.accepted_revision ?? null,
    lastAcceptedReason: latestSyncAcceptedPayload?.reason ?? null,
    validation,
  }
}
