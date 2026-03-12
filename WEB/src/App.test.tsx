import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'

function loadSampleText() {
  return readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8')
}

function buildDuplicateEventText() {
  const sample = JSON.parse(loadSampleText()) as {
    meta: { event_count: number }
    events: Array<Record<string, unknown>>
  }

  sample.meta.event_count += 1
  sample.events.push({ ...sample.events[0] })

  return JSON.stringify(sample)
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores the last stored sync file from localStorage', async () => {
    window.localStorage.setItem(
      'toeic-web-v1:last-sync-document',
      JSON.stringify({
        rawText: loadSampleText(),
        fileName: 'toeic_web_sync.json',
        savedAt: '2026-03-12T12:00:00+09:00',
      }),
    )

    render(<App />)

    expect(
      await screen.findByText('demel-toeic-workspace'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Part 5 품사/동사 반응 추적 시작'),
    ).toBeInTheDocument()
  })

  it('opens the raw json drawer', async () => {
    window.localStorage.setItem(
      'toeic-web-v1:last-sync-document',
      JSON.stringify({
        rawText: loadSampleText(),
        fileName: 'toeic_web_sync.json',
        savedAt: '2026-03-12T12:00:00+09:00',
      }),
    )

    const user = userEvent.setup()
    render(<App />)

    const rawJsonButtons = await screen.findAllByRole('button', {
      name: '원본 JSON 보기',
    })

    await user.click(rawJsonButtons[0])

    expect(
      await screen.findByRole('heading', { name: '원본 JSON' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/"workspace_id": "demel-toeic-workspace"/),
    ).toBeInTheDocument()
  })

  it('shows a blocking alert when restored data has semantic errors', async () => {
    window.localStorage.setItem(
      'toeic-web-v1:last-sync-document',
      JSON.stringify({
        rawText: buildDuplicateEventText(),
        fileName: 'toeic_web_sync.json',
        savedAt: '2026-03-12T12:00:00+09:00',
      }),
    )

    render(<App />)

    expect(
      await screen.findByText('저장된 파일에 차단 오류가 있어 복원하지 않았습니다.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/event_id가 중복됩니다/)[0]).toBeInTheDocument()
  })
})
