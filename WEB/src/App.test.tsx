import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App, { type LoadedDocument } from './App'
import { safePrettyJson } from './lib/format'
import { buildDashboardViewModel } from './lib/sync-view-model'
import { type ToeicWebSyncV1 } from './lib/sync-schema'
import { type DriveSyncAdapter } from './lib/google-drive'

function loadSampleText() {
  return readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8')
}

function loadSampleDocument(): LoadedDocument {
  const rawText = loadSampleText()
  const syncData = JSON.parse(rawText) as ToeicWebSyncV1

  return {
    syncData,
    rawText: safePrettyJson(syncData),
    fileName: 'toeic_web_sync.json',
    savedAt: '2026-03-12T12:00:00+09:00',
    source: 'restore',
    viewModel: buildDashboardViewModel(syncData),
  }
}

function createMockDriveAdapter(): DriveSyncAdapter {
  return {
    isConfigured: () => true,
    getConfigError: () => null,
    connect: vi.fn(async () => ({
      session: {
        folderId: 'folder-1',
        folderName: 'TOEIC Drive',
        liveFileId: 'file-1',
        backupsFolderId: 'backups-1',
        accountEmail: 'drive@test.dev',
        lastSyncAt: '2026-03-12T12:00:00+09:00',
        lastBackupAt: null,
      },
      rawText: loadSampleText(),
    })),
    refresh: vi.fn(async () => {
      throw new Error('not used')
    }),
    sync: vi.fn(async (session) => ({
      session: {
        ...session,
        lastSyncAt: '2026-03-12T12:01:00+09:00',
      },
      syncedAt: '2026-03-12T12:01:00+09:00',
      backedUpAt: null,
    })),
  }
}

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('restores the last stored drive document and starts with empty undo/redo history', async () => {
    window.localStorage.setItem(
      'toeic-web-v1:drive-context',
      JSON.stringify({
        folderId: 'folder-1',
        folderName: 'TOEIC Drive',
        liveFileId: 'file-1',
        backupsFolderId: 'backups-1',
        accountEmail: 'drive@test.dev',
        lastSyncAt: '2026-03-12T12:00:00+09:00',
        lastBackupAt: null,
      }),
    )

    render(<App driveAdapter={createMockDriveAdapter()} />)

    expect(await screen.findByText('demel-toeic-workspace')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled()
  })

  it('opens the raw json drawer', async () => {
    const user = userEvent.setup()
    render(<App initialDocument={loadSampleDocument()} />)

    const rawButtons = await screen.findAllByRole('button', { name: '원본 JSON' })
    await user.click(rawButtons[0])

    expect(await screen.findByRole('heading', { name: '원본 JSON' })).toBeInTheDocument()
    expect(screen.getByText(/"workspace_id": "demel-toeic-workspace"/)).toBeInTheDocument()
  })

  it('edits meta.revision and supports undo/redo buttons', async () => {
    const user = userEvent.setup()
    render(<App initialDocument={loadSampleDocument()} />)

    const metaButtons = await screen.findAllByRole('button', { name: '기본 정보' })
    await user.click(metaButtons[0])

    const revisionInput = await screen.findByLabelText('리비전 (revision)')
    await user.clear(revisionInput)
    await user.type(revisionInput, '9')
    await user.click(screen.getByRole('button', { name: 'meta 적용' }))

    expect((await screen.findAllByText('리비전 9'))[0]).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '되돌리기' })[0])
    expect((await screen.findAllByText('리비전 1'))[0]).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '다시 실행' })[0])
    expect((await screen.findAllByText('리비전 9'))[0]).toBeInTheDocument()
  }, 10000)

  it('keeps editing enabled but disables export when a blocking error is introduced', async () => {
    const user = userEvent.setup()
    render(<App initialDocument={loadSampleDocument()} />)

    const metaButtons = await screen.findAllByRole('button', { name: '기본 정보' })
    await user.click(metaButtons[0])

    const workspaceInput = await screen.findByLabelText('워크스페이스 ID (workspace_id)')
    const workspaceField = workspaceInput.closest('div')

    expect(workspaceField).not.toBeNull()
    await user.click(
      within(workspaceField as HTMLElement).getByRole('button', { name: '이 필드 삭제' }),
    )

    expect(await screen.findByText('현재 문서에 차단 오류가 있습니다.')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '비상 복구' })[0])
    expect(screen.getByRole('button', { name: 'JSON 파일로 내보내기' })).toBeDisabled()
  })
})
