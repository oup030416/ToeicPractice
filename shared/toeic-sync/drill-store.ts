import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'

import {
  safeParseDrillSetText,
  safeParseToeicWebSyncText,
  type DrillSetPublishedPayload,
  type DrillSetV1,
  type ToeicWebSyncEvent,
  type ToeicWebSyncV1,
} from './schema'
import { validateToeicWebSync } from './validation'

export interface LoadedDrillSetFile {
  path: string
  fileName: string
  drillSet: DrillSetV1
}

export interface LoadDrillSetsOptions {
  reviewedOnly?: boolean
}

export interface MergeDrillSetsOptions {
  reviewedOnly?: boolean
  timestamp?: string
}

export interface ExportSyncWithDrillSetsInput {
  baseSyncPath: string
  drillSetPaths: string[]
  outputPath: string
  reviewedOnly?: boolean
  timestamp?: string
}

export interface MergeResult {
  sync: ToeicWebSyncV1
  addedDrillSets: DrillSetV1[]
  addedEvents: ToeicWebSyncEvent[]
}

function cloneSync(sync: ToeicWebSyncV1) {
  return JSON.parse(JSON.stringify(sync)) as ToeicWebSyncV1
}

function createEventId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${String(index).padStart(3, '0')}`
}

function ensureLookupMembership(baseSync: ToeicWebSyncV1, drillSet: DrillSetV1) {
  const questionTypes = new Set(baseSync.lookups.question_types[drillSet.target_part] ?? [])
  const skillTags = new Set(baseSync.lookups.skill_tags)
  const vocabDomains = new Set(baseSync.lookups.vocab_domains)
  const documentGenres = new Set(baseSync.lookups.document_genres)

  for (const item of drillSet.items) {
    if (!questionTypes.has(item.question_type)) throw new Error(`drill_set ${drillSet.set_id}의 question_type이 lookups에 없습니다: ${item.question_type}`)
    if (!skillTags.has(item.skill_tag)) throw new Error(`drill_set ${drillSet.set_id}의 skill_tag가 lookups에 없습니다: ${item.skill_tag}`)
    if (!vocabDomains.has(item.vocab_domain)) throw new Error(`drill_set ${drillSet.set_id}의 vocab_domain이 lookups에 없습니다: ${item.vocab_domain}`)
    if (!documentGenres.has(item.document_genre)) throw new Error(`drill_set ${drillSet.set_id}의 document_genre가 lookups에 없습니다: ${item.document_genre}`)
  }
}

export async function loadDrillSetFile(path: string): Promise<LoadedDrillSetFile> {
  const rawText = await readFile(path, 'utf-8')
  const parsed = safeParseDrillSetText(rawText)
  if (!parsed.success) throw new Error(`${path}: ${parsed.message}`)
  return { path, fileName: basename(path), drillSet: parsed.data }
}

export async function saveDrillSetFile(path: string, drillSet: DrillSetV1): Promise<void> {
  const serialized = JSON.stringify(drillSet, null, 2) + '\n'
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, serialized, 'utf-8')
}

async function collectJsonFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(rootDir, entry.name)
      if (entry.isDirectory()) return collectJsonFiles(fullPath)
      return extname(entry.name).toLowerCase() === '.json' ? [fullPath] : []
    }),
  )
  return nested.flat().sort((left, right) => left.localeCompare(right, 'ko-KR'))
}

export async function loadDrillSetsFromDirectory(
  rootDir: string,
  options: LoadDrillSetsOptions = {},
): Promise<LoadedDrillSetFile[]> {
  const paths = await collectJsonFiles(rootDir)
  const loaded = await Promise.all(paths.map((path) => loadDrillSetFile(path)))
  return options.reviewedOnly === false ? loaded : loaded.filter((entry) => entry.drillSet.review_status === 'reviewed')
}

export function createDrillSetPublishedEvents(
  drillSets: DrillSetV1[],
  timestamp: string,
): ToeicWebSyncEvent[] {
  return drillSets.map((drillSet, index) => {
    const payload: DrillSetPublishedPayload = {
      set_id: drillSet.set_id,
      title: drillSet.title,
      target_part: drillSet.target_part,
      target_skill: drillSet.target_skill,
      difficulty: drillSet.difficulty,
      item_count: drillSet.items.length,
      review_status: drillSet.review_status,
    }

    return {
      event_id: createEventId('drill-set-published', index + 1),
      timestamp,
      actor: 'codex',
      event_type: 'drill_set.published',
      entity_type: 'drill_set',
      entity_id: drillSet.set_id,
      session_id: 'unknown',
      attempt_id: 'unknown',
      payload,
      supersedes_event_id: null,
    }
  })
}

export function mergeDrillSetsIntoSync(
  baseSync: ToeicWebSyncV1,
  drillSets: DrillSetV1[],
  options: MergeDrillSetsOptions = {},
): MergeResult {
  const timestamp = options.timestamp ?? new Date().toISOString()
  const included = options.reviewedOnly === false ? drillSets : drillSets.filter((drillSet) => drillSet.review_status === 'reviewed')
  const existingSetIds = new Set(baseSync.materials.drill_sets.map((set) => set.set_id))

  for (const drillSet of included) {
    if (existingSetIds.has(drillSet.set_id)) throw new Error(`이미 존재하는 drill_set set_id입니다: ${drillSet.set_id}`)
    ensureLookupMembership(baseSync, drillSet)
  }

  const nextSync = cloneSync(baseSync)
  const addedEvents = createDrillSetPublishedEvents(included, timestamp)
  nextSync.materials.drill_sets.push(...included)
  nextSync.events.push(...addedEvents)
  nextSync.meta = {
    ...nextSync.meta,
    revision: nextSync.meta.revision + 1,
    previous_revision: baseSync.meta.revision,
    exported_at: timestamp,
    exported_by: 'codex',
    event_count: nextSync.events.length,
    materials_revision: nextSync.meta.materials_revision + 1,
  }

  const validation = validateToeicWebSync(nextSync, JSON.stringify(nextSync))
  if (validation.errors.length > 0) throw new Error(`병합 결과 sync 검증 실패: ${validation.errors[0]?.message}`)

  return { sync: nextSync, addedDrillSets: included, addedEvents }
}

export async function exportSyncWithDrillSets(
  input: ExportSyncWithDrillSetsInput,
): Promise<MergeResult> {
  const baseText = await readFile(input.baseSyncPath, 'utf-8')
  const baseParsed = safeParseToeicWebSyncText(baseText)
  if (!baseParsed.success) throw new Error(`${input.baseSyncPath}: ${baseParsed.message}`)

  const loadedSets = await Promise.all(input.drillSetPaths.map((path) => loadDrillSetFile(path)))
  return mergeDrillSetsIntoSync(
    baseParsed.data,
    loadedSets.map((entry) => entry.drillSet),
    {
      reviewedOnly: input.reviewedOnly,
      timestamp: input.timestamp,
    },
  )
}
