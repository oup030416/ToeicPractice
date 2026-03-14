import {
  ACTOR_VALUES,
  ERROR_TYPE_VALUES,
  RC_PART_VALUES,
  RECOMMENDATION_STRENGTH_VALUES,
  REVIEW_STATE_VALUES,
  type ToeicWebSyncV1,
} from './sync-schema'

const DEFAULT_QUESTION_TYPES: ToeicWebSyncV1['lookups']['question_types'] = {
  'Part 5': [
    'parts of speech',
    'verb form',
    'tense',
    'subject-verb agreement',
    'voice',
    'infinitive / gerund / participle',
    'relative clause',
    'preposition',
    'conjunction',
    'vocabulary choice',
    'collocation',
  ],
  'Part 6': [
    'context completion',
    'sentence insertion',
    'coherence cue',
    'referent tracking',
    'logical connection',
    'vocabulary consistency',
  ],
  'Part 7': [
    'specific info',
    'purpose',
    'inference',
    'connect info',
    'paraphrase',
    'NOT / EXCEPT',
    'multi-document link',
    'visual info integration',
  ],
}

const DEFAULT_SKILL_TAGS = [
  'grammar reaction',
  'vocabulary discrimination',
  'context completion',
  'sentence insertion',
  'coherence cue',
  'evidence location',
  'paraphrase tracking',
  'connect info',
  'inference extraction',
  'multi-document link',
]

const DEFAULT_VOCAB_DOMAINS = [
  'contracts',
  'negotiations',
  'marketing',
  'sales',
  'warranties',
  'offices',
  'personnel',
  'purchasing',
  'travel',
  'finance',
  'business planning',
  'conferences',
  'housing',
  'dining out',
  'entertainment',
  'health',
  'corporate development',
  'general business',
]

const DEFAULT_DOCUMENT_GENRES = [
  'email',
  'letter',
  'notice',
  'advertisement',
  'article',
  'form',
  'online chat',
  'text message chain',
  'schedule',
  'report',
  'instruction',
  'information page',
  'memo',
]

export function createDefaultSyncDocument(
  workspaceId = 'toeic-drive-workspace',
): ToeicWebSyncV1 {
  const exportedAt = new Date().toISOString()

  return {
    meta: {
      workspace_id: workspaceId,
      schema_version: 'toeic-web-sync/v1',
      scope: 'rc',
      revision: 1,
      previous_revision: 0,
      exported_at: exportedAt,
      exported_by: ACTOR_VALUES[0],
      event_count: 0,
      materials_revision: 0,
    },
    lookups: {
      parts: [...RC_PART_VALUES],
      question_types: DEFAULT_QUESTION_TYPES,
      skill_tags: DEFAULT_SKILL_TAGS,
      vocab_domains: DEFAULT_VOCAB_DOMAINS,
      document_genres: DEFAULT_DOCUMENT_GENRES,
      error_types: [...ERROR_TYPE_VALUES],
      review_states: [...REVIEW_STATE_VALUES],
      recommendation_strengths: [...RECOMMENDATION_STRENGTH_VALUES],
    },
    materials: {
      official_sets: [],
      drill_sets: [],
    },
    events: [],
  }
}
