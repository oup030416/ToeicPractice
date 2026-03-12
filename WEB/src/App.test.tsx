import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import App from './App'

function loadSampleText() {
  return readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8')
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores the last stored draft and starts with empty undo/redo history', async () => {
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
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled()
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

    const rawButtons = await screen.findAllByRole('button', { name: '원본 JSON' })
    await user.click(rawButtons[0])

    expect(
      await screen.findByRole('heading', { name: '원본 JSON' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/"workspace_id": "demel-toeic-workspace"/),
    ).toBeInTheDocument()
  })

  it('edits meta.revision and supports undo/redo buttons', async () => {
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

    const metaButtons = await screen.findAllByRole('button', { name: '기본 정보' })
    await user.click(metaButtons[0])

    const revisionInput = await screen.findByLabelText('리비전 (revision)')
    await user.clear(revisionInput)
    await user.type(revisionInput, '9')
    await user.click(screen.getByRole('button', { name: 'meta 적용' }))

    expect(await screen.findByText('리비전 9')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '되돌리기' }))
    expect(await screen.findByText('리비전 1')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다시 실행' }))
    expect(await screen.findByText('리비전 9')).toBeInTheDocument()
  })

  it('keeps editing enabled but disables download when a blocking error is introduced', async () => {
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

    const metaButtons = await screen.findAllByRole('button', { name: '기본 정보' })
    await user.click(metaButtons[0])

    const workspaceInput = await screen.findByLabelText('워크스페이스 ID (workspace_id)')
    const workspaceField = workspaceInput.closest('div')

    expect(workspaceField).not.toBeNull()
    await user.click(
      within(workspaceField as HTMLElement).getByRole('button', { name: '이 필드 삭제' }),
    )

    expect(
      await screen.findByText('현재 드래프트에 차단 오류가 있습니다.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '현재 JSON 다운로드' })).toBeDisabled()
  })
})
