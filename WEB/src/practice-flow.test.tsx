import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import App, { type LoadedDocument } from './App'
import { safePrettyJson } from './lib/format'
import { buildDashboardViewModel } from './lib/sync-view-model'
import { type ToeicWebSyncV1 } from './lib/sync-schema'

function buildPracticeSync(): ToeicWebSyncV1 {
  return {
    meta: {
      workspace_id: 'practice-workspace',
      schema_version: 'toeic-web-sync/v1',
      scope: 'rc',
      revision: 1,
      previous_revision: 0,
      exported_at: '2026-03-12T12:00:00+09:00',
      exported_by: 'web',
      event_count: 0,
      materials_revision: 1,
    },
    lookups: {
      parts: ['Part 5', 'Part 6', 'Part 7'],
      question_types: {
        'Part 5': ['parts of speech'],
        'Part 6': [],
        'Part 7': [],
      },
      skill_tags: ['grammar reaction'],
      vocab_domains: ['general business'],
      document_genres: ['email'],
      error_types: [
        'grammar',
        'vocabulary',
        'paraphrase',
        'connect-info',
        'inference',
        'evidence-location',
        'time-pressure',
        'mixed',
      ],
      review_states: ['new', 'reviewed', 'repeated', 'stabilized'],
      recommendation_strengths: ['low', 'medium', 'high', 'critical'],
    },
    materials: {
      official_sets: [
        {
          set_id: 'official-001',
          title: '공식 세트 1',
          source_anchor: 'anchor-1',
          source_type: 'official',
          region: 'KR',
          part: 'Part 5',
          document_genre: 'email',
          passages: [],
          items: [
            {
              item_id: 'item-1',
              question_no: 1,
              part: 'Part 5',
              question_type: 'parts of speech',
              skill_tag: 'grammar reaction',
              vocab_domain: 'general business',
              document_genre: 'email',
              stem: 'Choose the best answer for question 1.',
              choices: [
                { key: 'A', text: 'Option A1' },
                { key: 'B', text: 'Option B1' },
                { key: 'C', text: 'Option C1' },
                { key: 'D', text: 'Option D1' },
              ],
              correct_answer: 'B',
            },
            {
              item_id: 'item-2',
              question_no: 2,
              part: 'Part 5',
              question_type: 'parts of speech',
              skill_tag: 'grammar reaction',
              vocab_domain: 'general business',
              document_genre: 'email',
              stem: 'Choose the best answer for question 2.',
              choices: [
                { key: 'A', text: 'Option A2' },
                { key: 'B', text: 'Option B2' },
                { key: 'C', text: 'Option C2' },
                { key: 'D', text: 'Option D2' },
              ],
              correct_answer: 'A',
            },
          ],
          imported_at: '2026-03-12T12:00:00+09:00',
          notes: null,
        },
      ],
      drill_sets: [],
    },
    events: [],
  }
}

function buildInitialDocument(): LoadedDocument {
  const syncData = buildPracticeSync()
  return {
    syncData,
    rawText: safePrettyJson(syncData),
    fileName: 'toeic_web_sync.json',
    savedAt: '2026-03-12T12:00:00+09:00',
    source: 'upload',
    viewModel: buildDashboardViewModel(syncData),
  }
}

describe('RC practice flow', () => {
  it('records a practice attempt and allows saving a memo', async () => {
    const user = userEvent.setup()
    render(<App initialDocument={buildInitialDocument()} />)

    await user.click(screen.getByRole('button', { name: 'RC 문제 풀기' }))
    expect(await screen.findByText('RC 문제 풀이 허브')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '문제 풀이 시작' })[1])
    expect(await screen.findByText('Choose the best answer for question 1.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /AOption A1/ }))
    await user.click(screen.getByRole('button', { name: '다음' }))
    await user.click(screen.getByRole('button', { name: /AOption A2/ }))
    await user.click(screen.getByRole('button', { name: '종료' }))
    await user.click(screen.getAllByRole('button', { name: '종료' })[1])

    expect(await screen.findByText('풀이 종료 개요')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '기록 보기' }))

    expect(await screen.findByText('공식 세트 1')).toBeInTheDocument()
    expect(screen.getByText(/선택 답 A \/ 정답 B/)).toBeInTheDocument()

    const memo = screen.getByPlaceholderText(
      '이 풀이에서 헷갈린 점, 다음에 다시 볼 포인트를 메모하세요.',
    )
    await user.type(memo, '다음에는 1번 품사 함정 다시 보기')
    await user.click(screen.getByRole('button', { name: '메모 저장' }))

    expect(await screen.findByDisplayValue('다음에는 1번 품사 함정 다시 보기')).toBeInTheDocument()
  })
})
