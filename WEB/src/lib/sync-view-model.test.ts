import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { safeParseToeicWebSyncText } from './sync-schema'
import { buildDashboardViewModel } from './sync-view-model'

function loadSampleText() {
  return readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8')
}

describe('buildDashboardViewModel', () => {
  it('builds recommendation, weakness, and event summaries from the current sync file', () => {
    const parsed = safeParseToeicWebSyncText(loadSampleText())

    if (!parsed.success) {
      throw new Error(parsed.message)
    }

    const viewModel = buildDashboardViewModel(parsed.data)

    expect(viewModel.meta.workspace_id).toBe('demel-toeic-workspace')
    expect(viewModel.latestRecommendations).toHaveLength(3)
    expect(viewModel.dashboardFocus[0]?.part).toBe('Part 5')
    expect(viewModel.topWeaknesses[0]?.priorityScore).toBe(70)
    expect(viewModel.eventTypeCounts).toHaveLength(4)
  })

  it('keeps unknown events available instead of dropping them', () => {
    const parsed = safeParseToeicWebSyncText(loadSampleText())

    if (!parsed.success) {
      throw new Error(parsed.message)
    }

    const extended = {
      ...parsed.data,
      meta: {
        ...parsed.data.meta,
        event_count: parsed.data.meta.event_count + 1,
      },
      events: [
        ...parsed.data.events,
        {
          event_id: 'future-01',
          timestamp: '2026-03-12T13:00:00+09:00',
          actor: 'web',
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

    const viewModel = buildDashboardViewModel(extended)
    const futureEvent = viewModel.allEvents.find((event) => event.eventType === 'future.event')

    expect(futureEvent).toBeDefined()
    expect(futureEvent?.description).toContain('future_entity')
  })
})
