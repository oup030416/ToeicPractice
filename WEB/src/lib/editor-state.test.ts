import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createEmptyEditorState, deleteValueAtPath, editorStateReducer, setValueAtPath } from './editor-state'

function loadSampleSync() {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), '../sync/toeic_web_sync.json'), 'utf-8'),
  ) as Record<string, unknown>
}

describe('editorStateReducer', () => {
  it('supports commit, undo, and redo', () => {
    const sample = loadSampleSync()
    const loaded = editorStateReducer(createEmptyEditorState(), {
      type: 'load_document',
      present: sample,
      fileName: 'toeic_web_sync.json',
      source: 'upload',
    })

    const patched = editorStateReducer(loaded, {
      type: 'commit_patch',
      nextPresent: setValueAtPath(sample, ['meta', 'revision'], 9),
    })

    expect(patched.currentParsed?.meta.revision).toBe(9)
    expect(patched.undoStack).toHaveLength(1)

    const undone = editorStateReducer(patched, { type: 'undo' })
    expect(undone.currentParsed?.meta.revision).toBe(1)
    expect(undone.redoStack).toHaveLength(1)

    const redone = editorStateReducer(undone, { type: 'redo' })
    expect(redone.currentParsed?.meta.revision).toBe(9)
  })

  it('keeps the last valid parsed snapshot when the draft becomes invalid', () => {
    const sample = loadSampleSync()
    const loaded = editorStateReducer(createEmptyEditorState(), {
      type: 'load_document',
      present: sample,
      fileName: 'toeic_web_sync.json',
      source: 'upload',
    })

    const broken = editorStateReducer(loaded, {
      type: 'delete_node',
      nextPresent: deleteValueAtPath(sample, ['meta', 'workspace_id']),
    })

    expect(broken.currentParsed).toBeNull()
    expect(broken.viewSyncData?.meta.workspace_id).toBe('demel-toeic-workspace')
    expect(broken.blockingIssues.some((issue) => issue.includes('meta.workspace_id'))).toBe(
      true,
    )
    expect(broken.isDownloadable).toBe(false)
  })
})
