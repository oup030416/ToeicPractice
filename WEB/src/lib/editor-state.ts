import { safePrettyJson } from './format'
import { safeParseToeicWebSync, type ToeicWebSyncV1 } from './sync-schema'
import {
  type SyncValidationIssue,
  type SyncValidationReport,
  validateToeicWebSync,
} from './sync-validation'
import {
  buildDashboardViewModel,
  type DashboardViewModel,
} from './sync-view-model'

export type EditorDocumentSource = 'upload' | 'restore'

export type DraftPathSegment = string | number

export interface EditableDocumentState {
  present: unknown | null
  rawText: string
  fileName: string | null
  savedAt: string | null
  source: EditorDocumentSource | null
  isDirty: boolean
  undoStack: unknown[]
  redoStack: unknown[]
  lastValidParsed: ToeicWebSyncV1 | null
  currentParsed: ToeicWebSyncV1 | null
  currentValidation: SyncValidationReport | null
  blockingIssues: string[]
  warnings: SyncValidationIssue[]
  viewSyncData: ToeicWebSyncV1 | null
  viewModel: DashboardViewModel | null
  isDownloadable: boolean
}

export type EditableDocumentAction =
  | {
      type: 'load_document'
      present: unknown
      fileName: string | null
      source: EditorDocumentSource
      savedAt?: string
    }
  | { type: 'commit_patch'; nextPresent: unknown }
  | { type: 'delete_node'; nextPresent: unknown }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset_history' }

export function createEmptyEditorState(): EditableDocumentState {
  return {
    present: null,
    rawText: '',
    fileName: null,
    savedAt: null,
    source: null,
    isDirty: false,
    undoStack: [],
    redoStack: [],
    lastValidParsed: null,
    currentParsed: null,
    currentValidation: null,
    blockingIssues: [],
    warnings: [],
    viewSyncData: null,
    viewModel: null,
    isDownloadable: false,
  }
}

export function cloneDraft<T>(value: T): T {
  if (value === undefined) {
    return value
  }

  return JSON.parse(JSON.stringify(value)) as T
}

function deriveEditorState(
  previousState: EditableDocumentState,
  present: unknown,
  meta: Pick<EditableDocumentState, 'fileName' | 'savedAt' | 'source' | 'isDirty'>,
  stacks: Pick<EditableDocumentState, 'undoStack' | 'redoStack'>,
): EditableDocumentState {
  const rawText = safePrettyJson(present)
  const parsed = safeParseToeicWebSync(present)

  if (parsed.success) {
    const validation = validateToeicWebSync(parsed.data, rawText)

    return {
      present,
      rawText,
      fileName: meta.fileName,
      savedAt: meta.savedAt,
      source: meta.source,
      isDirty: meta.isDirty,
      undoStack: stacks.undoStack,
      redoStack: stacks.redoStack,
      lastValidParsed: parsed.data,
      currentParsed: parsed.data,
      currentValidation: validation,
      blockingIssues: validation.errors.map((issue) => issue.message),
      warnings: validation.warnings,
      viewSyncData: parsed.data,
      viewModel: buildDashboardViewModel(parsed.data, validation),
      isDownloadable: validation.errors.length === 0,
    }
  }

  const fallbackParsed = previousState.lastValidParsed

  return {
    present,
    rawText,
    fileName: meta.fileName,
    savedAt: meta.savedAt,
    source: meta.source,
    isDirty: meta.isDirty,
    undoStack: stacks.undoStack,
    redoStack: stacks.redoStack,
    lastValidParsed: fallbackParsed,
    currentParsed: null,
    currentValidation: null,
    blockingIssues: parsed.issues,
    warnings: [],
    viewSyncData: fallbackParsed,
    viewModel: fallbackParsed ? buildDashboardViewModel(fallbackParsed) : null,
    isDownloadable: false,
  }
}

function commitDraft(
  previousState: EditableDocumentState,
  nextPresent: unknown,
): EditableDocumentState {
  if (previousState.present === null) {
    return previousState
  }

  return deriveEditorState(
    previousState,
    cloneDraft(nextPresent),
    {
      fileName: previousState.fileName,
      savedAt: new Date().toISOString(),
      source: previousState.source,
      isDirty: true,
    },
    {
      undoStack: [...previousState.undoStack, cloneDraft(previousState.present)],
      redoStack: [],
    },
  )
}

export function editorStateReducer(
  state: EditableDocumentState,
  action: EditableDocumentAction,
): EditableDocumentState {
  switch (action.type) {
    case 'load_document': {
      return deriveEditorState(
        createEmptyEditorState(),
        cloneDraft(action.present),
        {
          fileName: action.fileName,
          savedAt: action.savedAt ?? new Date().toISOString(),
          source: action.source,
          isDirty: false,
        },
        {
          undoStack: [],
          redoStack: [],
        },
      )
    }

    case 'commit_patch':
    case 'delete_node': {
      return commitDraft(state, action.nextPresent)
    }

    case 'undo': {
      if (state.present === null || state.undoStack.length === 0) {
        return state
      }

      const previousPresent = state.undoStack[state.undoStack.length - 1]

      return deriveEditorState(
        state,
        cloneDraft(previousPresent),
        {
          fileName: state.fileName,
          savedAt: new Date().toISOString(),
          source: state.source,
          isDirty: true,
        },
        {
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [cloneDraft(state.present), ...state.redoStack],
        },
      )
    }

    case 'redo': {
      if (state.present === null || state.redoStack.length === 0) {
        return state
      }

      const [nextPresent, ...remainingRedo] = state.redoStack

      return deriveEditorState(
        state,
        cloneDraft(nextPresent),
        {
          fileName: state.fileName,
          savedAt: new Date().toISOString(),
          source: state.source,
          isDirty: true,
        },
        {
          undoStack: [...state.undoStack, cloneDraft(state.present)],
          redoStack: remainingRedo,
        },
      )
    }

    case 'reset_history': {
      return {
        ...state,
        undoStack: [],
        redoStack: [],
        isDirty: false,
      }
    }
  }
}

export function tryParseDraftText(rawText: string) {
  try {
    return {
      success: true as const,
      data: JSON.parse(rawText) as unknown,
    }
  } catch {
    return {
      success: false as const,
    }
  }
}

export function getValueAtPath(root: unknown, path: DraftPathSegment[]) {
  let current = root

  for (const segment of path) {
    if (typeof segment === 'number') {
      if (!Array.isArray(current)) {
        return undefined
      }

      current = current[segment]
      continue
    }

    if (!current || typeof current !== 'object' || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

export function setValueAtPath(
  root: unknown,
  path: DraftPathSegment[],
  value: unknown,
): unknown {
  if (path.length === 0) {
    return cloneDraft(value)
  }

  const [head, ...rest] = path
  const clonedRoot = cloneDraft(root)

  if (typeof head === 'number') {
    const targetArray = Array.isArray(clonedRoot) ? [...clonedRoot] : []
    targetArray[head] = setValueAtPath(targetArray[head], rest, value)
    return targetArray
  }

  const targetObject =
    clonedRoot && typeof clonedRoot === 'object' && !Array.isArray(clonedRoot)
      ? { ...(clonedRoot as Record<string, unknown>) }
      : {}

  const nextSeed =
    rest.length > 0
      ? targetObject[head]
      : undefined

  targetObject[head] = rest.length
    ? setValueAtPath(nextSeed, rest, value)
    : cloneDraft(value)

  return targetObject
}

export function deleteValueAtPath(root: unknown, path: DraftPathSegment[]): unknown {
  if (path.length === 0) {
    return root
  }

  if (path.length === 1) {
    const [head] = path

    if (typeof head === 'number') {
      if (!Array.isArray(root)) {
        return root
      }

      const nextArray = [...root]
      nextArray.splice(head, 1)
      return nextArray
    }

    if (!root || typeof root !== 'object' || Array.isArray(root)) {
      return root
    }

    const nextObject = { ...(root as Record<string, unknown>) }
    delete nextObject[head]
    return nextObject
  }

  const [head, ...rest] = path

  if (typeof head === 'number') {
    if (!Array.isArray(root)) {
      return root
    }

    const nextArray = [...root]
    nextArray[head] = deleteValueAtPath(nextArray[head], rest)
    return nextArray
  }

  if (!root || typeof root !== 'object' || Array.isArray(root)) {
    return root
  }

  const nextObject = { ...(root as Record<string, unknown>) }
  nextObject[head] = deleteValueAtPath(nextObject[head], rest)
  return nextObject
}
