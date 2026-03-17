import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { safeParseDrillSetText, safeParseToeicWebSyncText } from './schema'
import {
  exportSyncWithDrillSets,
  loadDrillSetFile,
  loadDrillSetsFromDirectory,
  mergeDrillSetsIntoSync,
  saveDrillSetFile,
} from './drill-store'

const sampleSyncPath = resolve(process.cwd(), 'sync/toeic_web_sync.json')

function buildDrillSet(overrides: Record<string, unknown> = {}) {
  return {
    set_id: 'drill-p5-parts-of-speech-001',
    title: 'Part 5 Parts of Speech Reaction Set 001',
    source_anchor: '한국TOEIC위원회 공개문항 Part 5 계열 표현 관찰 기준',
    generation_mode: 'transform',
    target_part: 'Part 5',
    target_skill: 'parts of speech',
    difficulty: 'medium',
    items: [
      {
        item_id: 'drill-p5-pos-001-q01',
        question_no: 1,
        part: 'Part 5',
        question_type: 'parts of speech',
        skill_tag: 'grammar reaction',
        vocab_domain: 'general business',
        document_genre: 'memo',
        stem: 'The company plans to hire a ______ consultant for the system upgrade.',
        choices: [
          { key: 'A', text: 'specialize' },
          { key: 'B', text: 'specialized' },
          { key: 'C', text: 'specializes' },
          { key: 'D', text: 'specialization' },
        ],
        correct_answer: 'B',
        explanation: '관사 뒤 명사 수식 자리이므로 형용사가 와야 한다.',
      },
    ],
    answer_key: [{ item_id: 'drill-p5-pos-001-q01', question_no: 1, correct_answer: 'B' }],
    rationale: [{ item_id: 'drill-p5-pos-001-q01', question_no: 1, korean_explanation: '관사 뒤 명사 수식 자리이므로 형용사가 와야 한다.' }],
    review_status: 'reviewed',
    published_at: '2026-03-13T01:00:00+09:00',
    ...overrides,
  }
}

async function withTempDir<T>(run: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(tmpdir(), 'toeic-drill-store-'))
  try {
    return await run(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe('drill store', () => {
  it('parses a valid drill set file', async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, 'set.json')
      await writeFile(filePath, JSON.stringify(buildDrillSet(), null, 2), 'utf-8')

      const loaded = await loadDrillSetFile(filePath)

      expect(loaded.drillSet.set_id).toBe('drill-p5-parts-of-speech-001')
      expect(loaded.drillSet.items).toHaveLength(1)
    })
  })

  it('saves a drill set file in canonical json format', async () => {
    await withTempDir(async (dir) => {
      const filePath = join(dir, 'set.json')
      await saveDrillSetFile(filePath, buildDrillSet())

      const rawText = await readFile(filePath, 'utf-8')
      const parsed = safeParseDrillSetText(rawText)

      expect(parsed.success).toBe(true)
      expect(rawText.endsWith('\n')).toBe(true)
    })
  })

  it('fails merge when a drill set uses a lookup value outside the allowed taxonomy', async () => {
    const rawText = await readFile(sampleSyncPath, 'utf-8')
    const parsedSync = safeParseToeicWebSyncText(rawText)
    if (!parsedSync.success) throw new Error(parsedSync.message)

    const parsedDrill = safeParseDrillSetText(
      JSON.stringify(
        buildDrillSet({
          items: [
            {
              ...buildDrillSet().items[0],
              vocab_domain: 'outside-domain',
            },
          ],
        }),
      ),
    )

    if (!parsedDrill.success) throw new Error(parsedDrill.message)

    expect(() =>
      mergeDrillSetsIntoSync(parsedSync.data, [parsedDrill.data], {
        reviewedOnly: true,
        timestamp: '2026-03-13T02:00:00+09:00',
      }),
    ).toThrow(/lookups에 없습니다/)
  })

  it('loads only reviewed drill sets by default', async () => {
    await withTempDir(async (dir) => {
      await writeFile(join(dir, 'reviewed.json'), JSON.stringify(buildDrillSet(), null, 2), 'utf-8')
      await writeFile(
        join(dir, 'pending.json'),
        JSON.stringify(buildDrillSet({ set_id: 'drill-pending-001', review_status: 'pending' }), null, 2),
        'utf-8',
      )

      const loaded = await loadDrillSetsFromDirectory(dir)

      expect(loaded).toHaveLength(1)
      expect(loaded[0]?.drillSet.review_status).toBe('reviewed')
    })
  })

  it('merges reviewed drill sets and appends drill_set.published events', async () => {
    const rawText = await readFile(sampleSyncPath, 'utf-8')
    const parsed = safeParseToeicWebSyncText(rawText)
    if (!parsed.success) throw new Error(parsed.message)

    const secondSet = buildDrillSet({
      set_id: 'drill-p5-parts-of-speech-002',
      title: 'Part 5 Parts of Speech Reaction Set 002',
      items: [
        {
          ...buildDrillSet().items[0],
          item_id: 'drill-p5-pos-002-q01',
          question_no: 11,
          stem: 'All applicants must provide ______ references before the interview.',
        },
      ],
      answer_key: [{ item_id: 'drill-p5-pos-002-q01', question_no: 11, correct_answer: 'B' }],
      rationale: [{ item_id: 'drill-p5-pos-002-q01', question_no: 11, korean_explanation: '명사 references를 수식하는 형용사 자리다.' }],
    })

    const merged = mergeDrillSetsIntoSync(parsed.data, [buildDrillSet(), secondSet], {
      reviewedOnly: true,
      timestamp: '2026-03-13T02:00:00+09:00',
    })

    expect(merged.sync.materials.drill_sets).toHaveLength(2)
    expect(merged.addedEvents).toHaveLength(2)
    expect(merged.sync.events.at(-1)?.event_type).toBe('drill_set.published')
    expect(merged.sync.meta.previous_revision).toBe(parsed.data.meta.revision)
    expect(merged.sync.meta.revision).toBe(parsed.data.meta.revision + 1)
    expect(merged.sync.meta.materials_revision).toBe(parsed.data.meta.materials_revision + 1)
    expect(merged.sync.meta.event_count).toBe(merged.sync.events.length)
  })

  it('blocks duplicate drill set ids by default', async () => {
    const rawText = await readFile(sampleSyncPath, 'utf-8')
    const parsed = safeParseToeicWebSyncText(rawText)
    if (!parsed.success) throw new Error(parsed.message)

    const baseSync = {
      ...parsed.data,
      materials: {
        ...parsed.data.materials,
        drill_sets: [buildDrillSet()],
      },
    }

    expect(() =>
      mergeDrillSetsIntoSync(baseSync, [buildDrillSet()], {
        reviewedOnly: true,
        timestamp: '2026-03-13T02:00:00+09:00',
      }),
    ).toThrow(/이미 존재하는 drill_set/)
  })

  it('exports a merged sync file from drill set paths', async () => {
    await withTempDir(async (dir) => {
      const drillPath = join(dir, 'reviewed.json')
      const outPath = join(dir, 'out.json')
      await writeFile(drillPath, JSON.stringify(buildDrillSet(), null, 2), 'utf-8')

      const result = await exportSyncWithDrillSets({
        baseSyncPath: sampleSyncPath,
        drillSetPaths: [drillPath],
        outputPath: outPath,
        reviewedOnly: true,
        timestamp: '2026-03-13T03:00:00+09:00',
      })

      expect(result.sync.materials.drill_sets).toHaveLength(1)
      expect(result.addedEvents[0]?.payload).toMatchObject({
        set_id: 'drill-p5-parts-of-speech-001',
        item_count: 1,
      })
    })
  })
})
