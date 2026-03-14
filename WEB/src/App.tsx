import {
  BookOpen,
  Cloud,
  Download,
  Files,
  FolderInput,
  RefreshCw,
  Redo2,
  Settings2,
  TriangleAlert,
  Undo2,
  Upload,
} from 'lucide-react'
import {
  useEffectEvent,
  useDeferredValue,
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
} from 'react'

import { Badge } from './components/Badge'
import { DashboardSections, EmptyDashboardState } from './components/DashboardSections'
import { DetailDrawer } from './components/DetailDrawer'
import { DetailPanelContent } from './components/DetailPanelContent'
import { PracticeWorkspace } from './components/PracticeWorkspace'
import { ToastStack, type ToastItem } from './components/ToastStack'
import { downloadTextFile } from './lib/download'
import {
  createEmptyEditorState,
  editorStateReducer,
  tryParseDraftText,
  type EditableDocumentState,
} from './lib/editor-state'
import {
  clearStoredDriveContext,
  createGoogleDriveSyncAdapter,
  isInvalidDriveContextError,
  isReconnectRequiredError,
  loadStoredDriveContext,
  parseDriveDocumentText,
  saveStoredDriveContext,
  toDriveErrorMessage,
  type DriveConnectionState,
  type DriveSession,
  type DriveSyncAdapter,
} from './lib/google-drive'
import { cn, formatDateTime, slugifyFileName } from './lib/format'
import { buildPanelSubtitle, buildPanelTitle } from './lib/panel-meta'
import { safeParseToeicWebSync, type ToeicWebSyncV1 } from './lib/sync-schema'
import { type EventCardView } from './lib/sync-view-model'

export interface LoadedDocument {
  syncData: ToeicWebSyncV1
  rawText: string
  fileName: string | null
  savedAt: string
  source: 'upload' | 'restore'
  viewModel: NonNullable<EditableDocumentState['viewModel']>
}

export type DetailPanelState =
  | { type: 'meta' }
  | { type: 'event'; eventId: string }
  | { type: 'lookups' }
  | { type: 'materials' }
  | { type: 'raw' }
  | { type: 'events' }
  | null

interface AlertState {
  title: string
  items: string[]
  hint: string
}

const liveFileName = 'toeic_web_sync.json'
const autoSyncDelayMs = 1000
const actionButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold'

let nextToastId = 1

function buildDownloadName(fileName: string | null, workspaceId: string | null, revision: number | null) {
  const baseName = fileName?.replace(/\.json$/i, '')

  if (baseName) {
    return `${baseName}.json`
  }

  return `${slugifyFileName(workspaceId ?? 'toeic-web-sync')}-r${revision ?? 'draft'}.json`
}

function buildBlockingAlert(items: string[], title: string, hint: string): AlertState {
  return { title, items, hint }
}

function summarizeIssues(messages: string[], limit = 2) {
  const visible = messages.slice(0, limit)

  if (messages.length <= limit) {
    return visible.join(' / ')
  }

  return `${visible.join(' / ')} 외 ${messages.length - limit}건`
}

function createEditorStateFromInitialDocument(initialDocument: LoadedDocument | null) {
  if (!initialDocument) {
    return createEmptyEditorState()
  }

  return editorStateReducer(createEmptyEditorState(), {
    type: 'load_document',
    present: initialDocument.syncData,
    fileName: initialDocument.fileName,
    source: initialDocument.source,
    savedAt: initialDocument.savedAt,
  })
}

function createLoadedDocument(editorState: EditableDocumentState): LoadedDocument | null {
  if (
    !editorState.viewSyncData ||
    !editorState.viewModel ||
    !editorState.savedAt ||
    !editorState.source
  ) {
    return null
  }

  return {
    syncData: editorState.viewSyncData,
    viewModel: editorState.viewModel,
    rawText: editorState.rawText,
    fileName: editorState.fileName,
    savedAt: editorState.savedAt,
    source: editorState.source,
  }
}

function isTopLevelObject(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEditableTextTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function driveTone(state: DriveConnectionState) {
  switch (state) {
    case 'connected':
      return 'success'
    case 'syncing':
    case 'authorizing':
    case 'picking':
      return 'brand'
    case 'error':
    case 'reconnect-required':
      return 'danger'
    default:
      return 'neutral'
  }
}

export default function App({
  initialDocument = null,
  driveAdapter,
}: {
  initialDocument?: LoadedDocument | null
  driveAdapter?: DriveSyncAdapter
}) {
  const fileInputId = useId()
  const hydrateRef = useRef(false)
  const adapterRef = useRef<DriveSyncAdapter | null>(null)
  const lastSyncedRawRef = useRef<string | null>(initialDocument?.rawText ?? null)
  const syncTimerRef = useRef<number | null>(null)
  const [editorState, dispatch] = useReducer(
    editorStateReducer,
    initialDocument,
    createEditorStateFromInitialDocument,
  )
  const [loadAlert, setLoadAlert] = useState<AlertState | null>(null)
  const [panel, setPanel] = useState<DetailPanelState>(null)
  const [showPracticeWorkspace, setShowPracticeWorkspace] = useState(false)
  const [eventQuery, setEventQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [driveState, setDriveState] = useState<DriveConnectionState>('disconnected')
  const [driveMessage, setDriveMessage] = useState('Google Drive에 연결되지 않았습니다.')
  const [driveSession, setDriveSession] = useState<DriveSession | null>(null)
  const [driveError, setDriveError] = useState<string | null>(null)
  const [showRecoveryTools, setShowRecoveryTools] = useState(false)
  const [isPending, startDashboardTransition] = useTransition()
  const deferredEventQuery = useDeferredValue(eventQuery, '')

  if (!adapterRef.current) {
    adapterRef.current = driveAdapter ?? createGoogleDriveSyncAdapter()
  }

  const adapter = adapterRef.current
  const loadedDocument = createLoadedDocument(editorState)
  const viewModel = loadedDocument?.viewModel ?? null
  const hasDraft = editorState.present !== null
  const workspaceId =
    viewModel?.meta.workspace_id ??
    (typeof editorState.present === 'object' &&
    editorState.present &&
    'meta' in editorState.present &&
    typeof (editorState.present as { meta?: { workspace_id?: unknown } }).meta?.workspace_id ===
      'string'
      ? ((editorState.present as { meta?: { workspace_id?: string } }).meta?.workspace_id ?? null)
      : null)
  const revision =
    viewModel?.meta.revision ??
    (typeof editorState.present === 'object' &&
    editorState.present &&
    'meta' in editorState.present &&
    typeof (editorState.present as { meta?: { revision?: unknown } }).meta?.revision === 'number'
      ? ((editorState.present as { meta?: { revision?: number } }).meta?.revision ?? null)
      : null)

  const selectedEvent: EventCardView | null =
    panel?.type === 'event'
      ? loadedDocument?.viewModel?.allEvents.find((event) => event.id === panel.eventId) ?? null
      : null

  const filteredEvents = loadedDocument?.viewModel
    ? loadedDocument.viewModel.allEvents.filter((event) =>
        event.searchableText.includes(deferredEventQuery.trim().toLowerCase()),
      )
    : []

  const canOpenPractice =
    !showPracticeWorkspace &&
    editorState.currentParsed !== null &&
    editorState.blockingIssues.length === 0 &&
    loadedDocument !== null

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function pushToast(toast: Omit<ToastItem, 'id'>) {
    const id = nextToastId++
    setToasts((current) => [...current, { ...toast, id }])
    window.setTimeout(() => dismissToast(id), 3200)
  }

  function applyDraft(
    draft: unknown,
    fileName: string | null,
    source: 'upload' | 'restore',
    successLabel: string,
    options: { syncedRawText?: string | null; resetUi?: boolean } = {},
  ) {
    const previewState = editorStateReducer(createEmptyEditorState(), {
      type: 'load_document',
      present: draft,
      fileName,
      source,
      savedAt: new Date().toISOString(),
    })

    startDashboardTransition(() => {
      dispatch({
        type: 'load_document',
        present: draft,
        fileName,
        source,
      })
      if (options.resetUi ?? true) {
        setPanel(null)
        setShowPracticeWorkspace(false)
        setEventQuery('')
      }
      setLoadAlert(null)
    })

    if (options.syncedRawText !== undefined) {
      lastSyncedRawRef.current = options.syncedRawText
    }

    if (previewState.blockingIssues.length > 0) {
      pushToast({
        title: '차단 오류가 있는 문서를 불러왔습니다.',
        description: summarizeIssues(previewState.blockingIssues),
        tone: 'danger',
      })
      return
    }

    if (previewState.warnings.length > 0) {
      pushToast({
        title: `경고 ${previewState.warnings.length}건과 함께 문서를 불러왔습니다.`,
        description: `${successLabel}: ${summarizeIssues(
          previewState.warnings.map((issue) => issue.message),
        )}`,
        tone: 'accent',
      })
      return
    }

    pushToast({
      title: '문서를 불러왔습니다.',
      description: successLabel,
      tone: 'success',
    })
  }

  function commitDraftChange(
    nextPresent: unknown,
    options: {
      actionType?: 'commit_patch' | 'delete_node'
      title: string
      description: string
      nextPanel?: DetailPanelState
    },
  ) {
    startDashboardTransition(() => {
      dispatch({
        type: options.actionType ?? 'commit_patch',
        nextPresent,
      })
      if (options.nextPanel !== undefined) {
        setPanel(options.nextPanel)
      }
    })

    pushToast({
      title: options.title,
      description: options.description,
      tone: 'brand',
    })
  }

  async function loadDriveDocument(
    result: { session: DriveSession; rawText: string },
    label: string,
  ) {
    const parsedDraft = parseDriveDocumentText(result.rawText)
    if (!parsedDraft.success) {
      setLoadAlert(
        buildBlockingAlert(
          [parsedDraft.message],
          'Google Drive 파일을 읽지 못했습니다.',
          '폴더를 다시 선택하거나 비상 복구 패널에서 JSON을 직접 가져오세요.',
        ),
      )
      setDriveState('error')
      setDriveMessage('Google Drive 파일을 JSON으로 읽지 못했습니다.')
      setDriveError(parsedDraft.message)
      return
    }

    setDriveSession(result.session)
    saveStoredDriveContext(result.session)
    setDriveState('connected')
    setDriveMessage(
      `${result.session.folderName} 폴더와 연결됨 · 마지막 동기화 ${formatDateTime(
        result.session.lastSyncAt,
      )}`,
    )
    setDriveError(null)
    applyDraft(parsedDraft.data, liveFileName, 'restore', label, {
      syncedRawText: result.rawText,
    })
  }

  async function runDriveConnect(options: {
    interactive: boolean
    pickFolder: boolean
    successLabel: string
  }) {
      if (!adapter.isConfigured()) {
        const message = adapter.getConfigError() ?? 'Google Drive 설정이 없습니다.'
        setDriveState('error')
        setDriveMessage(message)
        setDriveError(message)
        setLoadAlert(
          buildBlockingAlert(
            [message],
            'Google Drive 설정이 필요합니다.',
            '.env 값과 Google Cloud Web OAuth 설정을 먼저 확인하세요.',
          ),
        )
        return
      }

      setDriveError(null)
      setDriveState(options.pickFolder ? 'picking' : 'authorizing')
      setDriveMessage(
        options.pickFolder ? 'Google Drive 폴더를 선택하는 중입니다.' : 'Google 로그인을 확인하는 중입니다.',
      )

      try {
        const result = await adapter.connect({
          context: driveSession ?? loadStoredDriveContext(),
          interactive: options.interactive,
          pickFolder: options.pickFolder,
          seedDocument: editorState.currentParsed,
        })

        await loadDriveDocument(result, options.successLabel)
      } catch (error) {
        const message = toDriveErrorMessage(error)

        if (isInvalidDriveContextError(error)) {
          clearStoredDriveContext()
          setDriveSession(null)
          setDriveState('disconnected')
          setDriveMessage('저장된 Drive 연결 정보가 더 이상 유효하지 않습니다. 폴더를 다시 선택하세요.')
          setDriveError(message)
          pushToast({
            title: 'Drive 연결 정보를 다시 선택해야 합니다.',
            description: message,
            tone: 'danger',
          })
          return
        }

        if (isReconnectRequiredError(error)) {
          setDriveState('reconnect-required')
          setDriveMessage('Google 로그인이 만료되었습니다. 재연결 후 다시 동기화됩니다.')
          setDriveError(message)
          pushToast({
            title: 'Google Drive 재연결이 필요합니다.',
            description: message,
            tone: 'danger',
          })
          return
        }

        setDriveState('error')
        setDriveMessage(message)
        setDriveError(message)
        pushToast({
          title: 'Google Drive 연결에 실패했습니다.',
          description: message,
          tone: 'danger',
        })
      }
  }

  async function runDriveRefresh() {
    if (!driveSession) {
      return
    }

    setDriveState('syncing')
    setDriveMessage('Google Drive 최신 문서를 불러오는 중입니다.')
    setDriveError(null)

    try {
      const result = await adapter.refresh(driveSession)
      await loadDriveDocument(result, 'Google Drive 최신본')
    } catch (error) {
      const message = toDriveErrorMessage(error)

      if (isInvalidDriveContextError(error)) {
        clearStoredDriveContext()
        setDriveSession(null)
        setDriveState('disconnected')
        setDriveMessage('저장된 Drive 연결 정보가 유효하지 않습니다. 폴더를 다시 선택하세요.')
      } else if (isReconnectRequiredError(error)) {
        setDriveState('reconnect-required')
        setDriveMessage('Google 로그인이 만료되었습니다. 재연결 후 새로고침할 수 있습니다.')
      } else {
        setDriveState('error')
        setDriveMessage(message)
      }

      setDriveError(message)
      pushToast({
        title: 'Google Drive 새로고침에 실패했습니다.',
        description: message,
        tone: 'danger',
      })
    }
  }

  async function runDriveSync(rawText: string) {
    if (!driveSession) {
      return
    }

    setDriveState('syncing')
    setDriveMessage('Google Drive에 변경 내용을 저장하는 중입니다.')
    setDriveError(null)

    try {
      const result = await adapter.sync(driveSession, rawText)
      setDriveSession(result.session)
      saveStoredDriveContext(result.session)
      lastSyncedRawRef.current = rawText
      setDriveState('connected')
      setDriveMessage(
        result.backedUpAt
          ? `Drive 저장 완료 · 백업 ${formatDateTime(result.backedUpAt)} · 마지막 동기화 ${formatDateTime(result.syncedAt)}`
          : `Drive 저장 완료 · 마지막 동기화 ${formatDateTime(result.syncedAt)}`,
      )
      setDriveError(null)
    } catch (error) {
      const message = toDriveErrorMessage(error)

      if (isInvalidDriveContextError(error)) {
        clearStoredDriveContext()
        setDriveSession(null)
        setDriveState('disconnected')
        setDriveMessage('저장된 Drive 파일을 찾지 못했습니다. 폴더를 다시 선택하세요.')
      } else if (isReconnectRequiredError(error)) {
        setDriveState('reconnect-required')
        setDriveMessage('Google 로그인이 만료되어 자동 저장을 멈췄습니다. 재연결해 주세요.')
      } else {
        setDriveState('error')
        setDriveMessage(message)
      }

      setDriveError(message)
      pushToast({
        title: 'Google Drive 자동 저장에 실패했습니다.',
        description: message,
        tone: 'danger',
      })
    }
  }

  const restoreStoredDriveEffect = useEffectEvent(() => {
    void runDriveConnect({
      interactive: false,
      pickFolder: false,
      successLabel: '저장된 Google Drive 폴더',
    })
  })

  const autoSyncEffect = useEffectEvent((rawText: string) => {
    void runDriveSync(rawText)
  })

  const pushHistoryToastEffect = useEffectEvent(
    (title: string, description: string) => {
      pushToast({
        title,
        description,
        tone: 'accent',
      })
    },
  )

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    const rawText = await file.text()
    const draftResult = tryParseDraftText(rawText)

    if (!draftResult.success) {
      setLoadAlert(
        buildBlockingAlert(
          ['JSON 문법이 올바르지 않습니다.'],
          '파일을 불러오지 못했습니다.',
          '문법 오류를 수정한 뒤 다시 업로드해 주세요.',
        ),
      )
      pushToast({
        title: '복구용 JSON 가져오기에 실패했습니다.',
        description: 'JSON 문법이 올바르지 않습니다.',
        tone: 'danger',
      })
      event.target.value = ''
      return
    }

    if (!isTopLevelObject(draftResult.data)) {
      setLoadAlert(
        buildBlockingAlert(
          ['최상위 JSON 구조는 객체여야 합니다.'],
          '파일을 불러오지 못했습니다.',
          '최상위가 객체인 JSON 문서를 업로드해 주세요.',
        ),
      )
      pushToast({
        title: '복구용 JSON 가져오기에 실패했습니다.',
        description: '최상위 JSON 구조는 객체여야 합니다.',
        tone: 'danger',
      })
      event.target.value = ''
      return
    }

    applyDraft(draftResult.data, file.name, 'upload', file.name)
    event.target.value = ''
  }

  function handleDownload() {
    if (!editorState.present || !editorState.isDownloadable) {
      return
    }

    const parsed = safeParseToeicWebSync(editorState.present)
    if (!parsed.success) {
      pushToast({
        title: 'JSON 내보내기를 막았습니다.',
        description: parsed.message,
        tone: 'danger',
      })
      return
    }

    const fileName = buildDownloadName(
      editorState.fileName,
      parsed.data.meta.workspace_id,
      parsed.data.meta.revision,
    )

    downloadTextFile(fileName, editorState.rawText, 'application/json;charset=utf-8')
    pushToast({
      title: '현재 JSON을 파일로 내보냈습니다.',
      description: fileName,
      tone: 'success',
    })
  }

  useEffect(() => {
    if (hydrateRef.current) {
      return
    }

    hydrateRef.current = true

    if (initialDocument) {
      return
    }

    const storedContext = loadStoredDriveContext()
    if (!storedContext) {
      return
    }

    setDriveSession(storedContext)
    restoreStoredDriveEffect()
  }, [initialDocument])

  useEffect(() => {
    if (syncTimerRef.current !== null) {
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }

    if (!driveSession || !editorState.present) {
      return
    }

    if (editorState.blockingIssues.length > 0) {
      setDriveMessage('차단 오류가 있어 Google Drive 자동 저장을 보류했습니다.')
      return
    }

    if (driveState === 'reconnect-required' || driveState === 'authorizing' || driveState === 'picking') {
      return
    }

    if (lastSyncedRawRef.current === editorState.rawText) {
      return
    }

    syncTimerRef.current = window.setTimeout(() => {
      syncTimerRef.current = null
      autoSyncEffect(editorState.rawText)
    }, autoSyncDelayMs)

    return () => {
      if (syncTimerRef.current !== null) {
        window.clearTimeout(syncTimerRef.current)
        syncTimerRef.current = null
      }
    }
  }, [
    driveSession,
    driveState,
    editorState.blockingIssues.length,
    editorState.present,
    editorState.rawText,
  ])

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const hasModifier = event.ctrlKey || event.metaKey
      if (!hasModifier || isEditableTextTarget(event.target)) {
        return
      }

      const isUndo = event.key.toLowerCase() === 'z' && !event.shiftKey
      const isRedo = event.key.toLowerCase() === 'z' && event.shiftKey

      if (isUndo && editorState.undoStack.length > 0) {
        event.preventDefault()
        dispatch({ type: 'undo' })
        pushHistoryToastEffect('되돌리기를 적용했습니다.', '직전 변경을 복구했습니다.')
      }

      if (isRedo && editorState.redoStack.length > 0) {
        event.preventDefault()
        dispatch({ type: 'redo' })
        pushHistoryToastEffect('다시 실행을 적용했습니다.', '되돌린 변경을 다시 반영했습니다.')
      }
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [editorState.redoStack.length, editorState.undoStack.length])

  const draftBlockingAlert =
    hasDraft && editorState.blockingIssues.length > 0
      ? buildBlockingAlert(
          editorState.blockingIssues,
          '현재 문서에 차단 오류가 있습니다.',
          driveSession
            ? '오류가 있는 동안에는 Google Drive 자동 저장을 멈춥니다. 오류를 고치면 다시 자동 저장됩니다.'
            : '오류를 수정한 뒤 Google Drive에 연결하거나 복구용 내보내기를 진행하세요.',
        )
      : null

  return (
    <>
      <main className="mx-auto max-w-[1440px] px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <div className="space-y-6">
          <header className="rounded-[32px] border border-blue-100 bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-5 text-white shadow-[0_28px_90px_rgba(15,23,42,0.28)] sm:p-6 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
              <div className="max-w-3xl space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-white/12 text-white ring-white/20" tone="neutral">TOEIC WEB v1</Badge>
                  <Badge className="bg-emerald-300 text-slate-950 ring-emerald-200" tone={driveTone(driveState)}>Google Drive 연동</Badge>
                  {revision !== null ? <Badge className="bg-white/12 text-white ring-white/20" tone="neutral">리비전 {revision}</Badge> : null}
                  {editorState.isDirty ? <Badge className="bg-amber-300 text-slate-950 ring-amber-200" tone="accent">로컬 변경 있음</Badge> : null}
                </div>
                <div className="space-y-3">
                  <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">Google Drive 기반 RC 학습 기록 대시보드</h1>
                  <p className="max-w-2xl text-base leading-7 text-blue-50/90 sm:text-lg">
                    이제 `toeic_web_sync.json`은 Google Drive 폴더 안에서 자동으로 불러오고 저장합니다. 편집, 메모, RC 문제 풀이 기록은 1초 debounce 후 Drive live 파일에 반영되고, 30분마다 백업본이 추가됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-3 xl:w-[36rem]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <button className={cn(actionButtonClass, 'border-white/20 bg-white/10 text-white hover:bg-white/16 disabled:cursor-not-allowed disabled:opacity-50')} disabled={driveState === 'authorizing' || driveState === 'picking' || !adapter.isConfigured()} onClick={() => void runDriveConnect({ interactive: true, pickFolder: true, successLabel: 'Google Drive 폴더' })} type="button"><Cloud className="size-4" />{driveSession ? '폴더 변경' : 'Google Drive 연결'}</button>
                  <button className={cn(actionButtonClass, 'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!driveSession || driveState === 'syncing' || driveState === 'authorizing' || driveState === 'picking'} onClick={() => void runDriveRefresh()} type="button"><RefreshCw className="size-4" />지금 새로고침</button>
                  <button className={cn(actionButtonClass, 'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!driveSession || (driveState !== 'reconnect-required' && driveState !== 'error')} onClick={() => void runDriveConnect({ interactive: true, pickFolder: false, successLabel: 'Google Drive 재연결' })} type="button"><Cloud className="size-4" />재연결</button>
                  <button className={cn(actionButtonClass, 'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55')} onClick={() => setShowRecoveryTools((current) => !current)} type="button"><Settings2 className="size-4" />비상 복구</button>
                  <button aria-label="되돌리기" className={cn(actionButtonClass, 'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50')} disabled={editorState.undoStack.length === 0} onClick={() => { dispatch({ type: 'undo' }); pushToast({ title: '되돌리기를 적용했습니다.', description: '직전 변경을 복구했습니다.', tone: 'accent' }) }} type="button"><Undo2 className="size-4" />되돌리기</button>
                  <button aria-label="다시 실행" className={cn(actionButtonClass, 'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50')} disabled={editorState.redoStack.length === 0} onClick={() => { dispatch({ type: 'redo' }); pushToast({ title: '다시 실행을 적용했습니다.', description: '되돌린 변경을 다시 반영했습니다.', tone: 'accent' }) }} type="button"><Redo2 className="size-4" />다시 실행</button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => setPanel({ type: 'meta' })} type="button"><FolderInput className="size-4" />기본 정보</button>
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => setPanel({ type: 'lookups' })} type="button">분류표</button>
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => setPanel({ type: 'materials' })} type="button">자료</button>
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => setPanel({ type: 'events' })} type="button"><Files className="size-4" />이벤트</button>
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => setPanel({ type: 'raw' })} type="button">원본 JSON</button>
                  <button className={cn('inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12', 'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!hasDraft} onClick={() => { if (!canOpenPractice) { pushToast({ title: 'RC 문제 풀이를 열 수 없습니다.', description: hasDraft && editorState.blockingIssues.length > 0 ? '차단 오류를 먼저 해결해야 합니다.' : '유효한 동기화 문서를 먼저 불러와야 합니다.', tone: 'danger' }); return } setPanel(null); setShowPracticeWorkspace(true) }} type="button"><BookOpen className="size-4" />RC 문제 풀기</button>
                </div>

                <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-3 text-sm leading-6 text-blue-50/85">
                  <p className="font-semibold text-white">동기화 상태</p>
                  <p>{driveMessage}</p>
                  {driveSession ? <><p>연결 폴더: {driveSession.folderName}</p><p>계정: {driveSession.accountEmail ?? '알 수 없음'}</p></> : null}
                  {workspaceId ? <p>워크스페이스: {workspaceId}</p> : null}
                </div>

                {showRecoveryTools ? (
                  <div className="rounded-3xl border border-white/12 bg-slate-950/35 px-4 py-4 text-sm text-blue-50/85">
                    <div className="mb-3 flex items-center gap-2 text-white"><Settings2 className="size-4" /><p className="font-semibold">비상 복구 도구</p></div>
                    <p className="mb-4 leading-6">Google 설정 문제나 긴급 백업이 필요할 때만 사용하세요. 여기서 불러온 JSON도 Drive가 연결된 상태라면 이후 자동으로 동기화됩니다.</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className={cn(actionButtonClass, 'cursor-pointer border-white/16 bg-white/8 text-white hover:bg-white/14')} htmlFor={fileInputId}><Upload className="size-4" />복구용 JSON 가져오기</label>
                      <input accept="application/json,.json" className="sr-only" id={fileInputId} onChange={handleFileChange} type="file" />
                      <button className={cn(actionButtonClass, 'border-white/16 bg-white/8 text-white hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-50')} disabled={!editorState.present || !editorState.isDownloadable} onClick={handleDownload} type="button"><Download className="size-4" />JSON 파일로 내보내기</button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {!adapter.isConfigured() ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm" role="alert">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold leading-6">Google Drive 환경 변수가 아직 설정되지 않았습니다.</p>
                  <p className="text-sm leading-6">`VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, `VITE_GOOGLE_APP_ID` 값을 넣고 다시 실행해야 로그인과 Picker가 동작합니다.</p>
                </div>
              </div>
            </section>
          ) : null}

          {loadAlert ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm" role="alert">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-3">
                  <p className="text-sm font-semibold leading-6">{loadAlert.title}</p>
                  <ul className="space-y-2 text-sm leading-6">{loadAlert.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  <p className="text-sm leading-6">{loadAlert.hint}</p>
                </div>
              </div>
            </section>
          ) : null}

          {driveError && !loadAlert ? (
            <section className={cn('rounded-3xl px-5 py-4 shadow-sm', driveState === 'reconnect-required' ? 'border border-amber-200 bg-amber-50 text-amber-950' : 'border border-rose-200 bg-rose-50 text-rose-950')} role="alert">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-2">
                  <p className="text-sm font-semibold leading-6">{driveState === 'reconnect-required' ? 'Google Drive 재연결이 필요합니다.' : 'Google Drive 오류가 발생했습니다.'}</p>
                  <p className="text-sm leading-6">{driveError}</p>
                </div>
              </div>
            </section>
          ) : null}

          {draftBlockingAlert ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm" role="alert">
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-3">
                  <p className="text-sm font-semibold leading-6">{draftBlockingAlert.title}</p>
                  <ul className="space-y-2 text-sm leading-6">{draftBlockingAlert.items.map((item) => <li key={item}>{item}</li>)}</ul>
                  <p className="text-sm leading-6">{draftBlockingAlert.hint}</p>
                </div>
              </div>
            </section>
          ) : null}

          {!draftBlockingAlert && editorState.warnings.length > 0 ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm">
              <div className="space-y-3">
                <p className="text-sm font-semibold leading-6">검증 경고 {editorState.warnings.length}건이 있습니다.</p>
                <ul className="space-y-2 text-sm leading-6">{editorState.warnings.map((issue) => <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>)}</ul>
              </div>
            </section>
          ) : null}

          {showPracticeWorkspace && loadedDocument ? (
            <PracticeWorkspace
              onClose={() => setShowPracticeWorkspace(false)}
              onCommitSync={(nextSync, options) => commitDraftChange(nextSync, { title: options.title, description: options.description })}
              onNotify={pushToast}
              syncData={loadedDocument.syncData}
              viewModel={loadedDocument.viewModel}
            />
          ) : viewModel ? (
            <DashboardSections
              loadedDocument={loadedDocument as LoadedDocument}
              onOpenEvent={(eventId) => setPanel({ type: 'event', eventId })}
              onOpenEvents={() => setPanel({ type: 'events' })}
              onOpenLookups={() => setPanel({ type: 'lookups' })}
              onOpenMaterials={() => setPanel({ type: 'materials' })}
              onOpenMeta={() => setPanel({ type: 'meta' })}
              onOpenRaw={() => setPanel({ type: 'raw' })}
            />
          ) : (
            <EmptyDashboardState
              hasDraft={hasDraft}
              message={adapter.isConfigured() ? 'Google Drive에 연결하면 RC 학습 기록, 약점, 추천, 이벤트를 여기서 바로 확인할 수 있습니다.' : 'Google Drive 설정을 먼저 넣어야 문서를 불러올 수 있습니다.'}
            />
          )}
        </div>
      </main>

      <DetailDrawer
        onClose={() => setPanel(null)}
        open={panel !== null && !showPracticeWorkspace}
        subtitle={buildPanelSubtitle(panel, loadedDocument, filteredEvents.length)}
        title={buildPanelTitle(panel, selectedEvent)}
      >
        <DetailPanelContent
          editorState={editorState}
          eventQuery={eventQuery}
          filteredEvents={filteredEvents}
          loadedDocument={loadedDocument}
          onCommitDraftChange={commitDraftChange}
          onEventQueryChange={setEventQuery}
          onOpenEvent={(eventId) => setPanel({ type: 'event', eventId })}
          panel={panel}
          selectedEvent={selectedEvent}
        />
      </DetailDrawer>

      <ToastStack toasts={toasts} />

      {isPending ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-950 shadow-lg">대시보드를 다시 계산하는 중입니다.</div>
      ) : null}
    </>
  )
}
