import {
  BookOpen,
  Download,
  Files,
  FolderInput,
  Redo2,
  TriangleAlert,
  Undo2,
  Upload,
} from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
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
import { ToastStack, type ToastItem } from './components/ToastStack'
import { downloadTextFile } from './lib/download'
import {
  createEmptyEditorState,
  editorStateReducer,
  tryParseDraftText,
  type EditableDocumentState,
} from './lib/editor-state'
import { cn, slugifyFileName } from './lib/format'
import { buildPanelSubtitle, buildPanelTitle } from './lib/panel-meta'
import { safeParseToeicWebSync, type ToeicWebSyncV1 } from './lib/sync-schema'
import { loadStoredDraftDocument, saveStoredDraftDocument } from './lib/storage'
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
  | { type: 'placeholder' }
  | null

interface AlertState {
  title: string
  items: string[]
  hint: string
}

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
  return {
    title,
    items,
    hint,
  }
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

  const tagName = target.tagName

  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT'
}

export default function App({
  initialDocument = null,
}: {
  initialDocument?: LoadedDocument | null
}) {
  const fileInputId = useId()
  const hydrateRef = useRef(false)
  const [editorState, dispatch] = useReducer(
    editorStateReducer,
    initialDocument,
    createEditorStateFromInitialDocument,
  )
  const [loadAlert, setLoadAlert] = useState<AlertState | null>(null)
  const [panel, setPanel] = useState<DetailPanelState>(null)
  const [eventQuery, setEventQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isPending, startDashboardTransition] = useTransition()
  const deferredEventQuery = useDeferredValue(eventQuery, '')

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
      ? loadedDocument?.viewModel?.allEvents.find((event) => event.id === panel.eventId) ??
        null
      : null

  const filteredEvents = loadedDocument?.viewModel
    ? loadedDocument.viewModel.allEvents.filter((event) =>
        event.searchableText.includes(deferredEventQuery.trim().toLowerCase()),
      )
    : []

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function pushToast(toast: Omit<ToastItem, 'id'>) {
    const id = nextToastId++
    setToasts((current) => [...current, { ...toast, id }])
    window.setTimeout(() => dismissToast(id), 3200)
  }

  function loadDraft(
    draft: unknown,
    fileName: string | null,
    source: 'upload' | 'restore',
    successLabel: string,
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
      setPanel(null)
      setEventQuery('')
      setLoadAlert(null)
    })

    if (previewState.blockingIssues.length > 0) {
      pushToast({
        title: '차단 오류가 있는 드래프트를 불러왔습니다.',
        description: summarizeIssues(previewState.blockingIssues),
        tone: 'danger',
      })
      return
    }

    if (previewState.warnings.length > 0) {
      pushToast({
        title: `경고 ${previewState.warnings.length}건과 함께 불러왔습니다.`,
        description: `${successLabel}: ${summarizeIssues(
          previewState.warnings.map((issue) => issue.message),
        )}`,
        tone: 'accent',
      })
      return
    }

    pushToast({
      title: 'JSON을 불러왔습니다.',
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
        title: '업로드에 실패했습니다.',
        description: 'JSON 문법이 올바르지 않습니다.',
        tone: 'danger',
      })
      event.target.value = ''
      return
    }

    if (!isTopLevelObject(draftResult.data)) {
      setLoadAlert(
        buildBlockingAlert(
          ['최상위 JSON 객체만 편집할 수 있습니다.'],
          '파일을 불러오지 못했습니다.',
          '최상위가 객체인 JSON 문서를 업로드해 주세요.',
        ),
      )
      pushToast({
        title: '업로드에 실패했습니다.',
        description: '최상위 JSON 객체만 편집할 수 있습니다.',
        tone: 'danger',
      })
      event.target.value = ''
      return
    }

    loadDraft(draftResult.data, file.name, 'upload', file.name)
    event.target.value = ''
  }

  function handleDownload() {
    if (!editorState.present || !editorState.isDownloadable) {
      return
    }

    const parsed = safeParseToeicWebSync(editorState.present)

    if (!parsed.success) {
      pushToast({
        title: '다운로드를 막았습니다.',
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

    downloadTextFile(
      fileName,
      editorState.rawText,
      'application/json;charset=utf-8',
    )

    pushToast({
      title: '현재 드래프트를 다운로드했습니다.',
      description: fileName,
      tone: 'success',
    })
  }

  const pushToastFromEffect = useEffectEvent((toast: Omit<ToastItem, 'id'>) => {
    pushToast(toast)
  })

  const pushHistoryToast = useEffectEvent((toast: Omit<ToastItem, 'id'>) => {
    pushToast(toast)
  })

  useEffect(() => {
    if (!editorState.present || !editorState.savedAt) {
      return
    }

    saveStoredDraftDocument({
      rawText: editorState.rawText,
      fileName: editorState.fileName,
      savedAt: editorState.savedAt,
    })
  }, [editorState.present, editorState.rawText, editorState.fileName, editorState.savedAt])

  useEffect(() => {
    if (hydrateRef.current) {
      return
    }

    hydrateRef.current = true

    if (initialDocument) {
      return
    }

    const storedDocument = loadStoredDraftDocument()

    if (!storedDocument) {
      return
    }

    const parsedDraft = tryParseDraftText(storedDocument.rawText)

    if (!parsedDraft.success || !isTopLevelObject(parsedDraft.data)) {
      setLoadAlert(
        buildBlockingAlert(
          ['저장된 로컬 드래프트를 읽을 수 없습니다.'],
          '저장된 파일을 복원하지 못했습니다.',
          '새 JSON을 다시 업로드해 주세요.',
        ),
      )
      pushToastFromEffect({
        title: '이전 로컬 데이터를 복원하지 못했습니다.',
        description: '저장된 드래프트 JSON이 손상되었습니다.',
        tone: 'danger',
      })
      return
    }

    startDashboardTransition(() => {
      dispatch({
        type: 'load_document',
        present: parsedDraft.data,
        fileName: storedDocument.fileName,
        source: 'restore',
        savedAt: storedDocument.savedAt,
      })
      setLoadAlert(null)
    })

    pushToastFromEffect({
      title: '최근 로컬 드래프트를 복원했습니다.',
      description: storedDocument.fileName ?? '브라우저 저장본',
      tone: 'brand',
    })
  }, [initialDocument, startDashboardTransition])

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
        pushHistoryToast({
          title: '되돌리기를 적용했습니다.',
          description: '직전 변경을 복구했습니다.',
          tone: 'accent',
        })
      }

      if (isRedo && editorState.redoStack.length > 0) {
        event.preventDefault()
        dispatch({ type: 'redo' })
        pushHistoryToast({
          title: '다시 실행을 적용했습니다.',
          description: '되돌린 변경을 다시 반영했습니다.',
          tone: 'accent',
        })
      }
    }

    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [editorState.undoStack.length, editorState.redoStack.length])

  const draftBlockingAlert =
    hasDraft && editorState.blockingIssues.length > 0
      ? buildBlockingAlert(
          editorState.blockingIssues,
          '현재 드래프트에 차단 오류가 있습니다.',
          '편집과 로컬 저장은 계속 가능하지만, 다운로드는 오류를 해결할 때까지 막습니다.',
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
                  <Badge className="bg-white/12 text-white ring-white/20" tone="neutral">
                    TOEIC WEB v1
                  </Badge>
                  <Badge className="bg-amber-300 text-slate-950 ring-amber-200" tone="accent">
                    로컬 드래프트 편집기
                  </Badge>
                  {revision !== null ? (
                    <Badge
                      className="bg-emerald-300 text-slate-950 ring-emerald-200"
                      tone="success"
                    >
                      리비전 {revision}
                    </Badge>
                  ) : null}
                  {editorState.isDirty ? (
                    <Badge className="bg-white/12 text-white ring-white/20" tone="neutral">
                      로컬 변경 있음
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
                    RC 웹 연동 JSON을 읽고,
                    <br />
                    수정·삭제·되돌리기까지 처리하는 드래프트 편집기
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-blue-50/90 sm:text-lg">
                    업로드한 `toeic_web_sync.json`을 로컬 드래프트로 열고, meta,
                    lookups, materials, events 전체를 구조화된 우측 편집기에서
                    수정할 수 있습니다.
                  </p>
                </div>
              </div>

              <div className="space-y-3 xl:w-[34rem]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={cn(
                      actionButtonClass,
                      'cursor-pointer border-white/20 bg-white/10 text-white hover:bg-white/16',
                    )}
                    htmlFor={fileInputId}
                  >
                    <Upload className="size-4" />
                    JSON 업로드
                  </label>
                  <input
                    accept="application/json,.json"
                    className="sr-only"
                    id={fileInputId}
                    onChange={handleFileChange}
                    type="file"
                  />

                  <button
                    className={cn(
                      actionButtonClass,
                      'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!editorState.present || !editorState.isDownloadable}
                    onClick={handleDownload}
                    type="button"
                  >
                    <Download className="size-4" />
                    현재 JSON 다운로드
                  </button>

                  <button
                    aria-label="되돌리기"
                    className={cn(
                      actionButtonClass,
                      'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={editorState.undoStack.length === 0}
                    onClick={() => {
                      dispatch({ type: 'undo' })
                      pushToast({
                        title: '되돌리기를 적용했습니다.',
                        description: '직전 변경을 복구했습니다.',
                        tone: 'accent',
                      })
                    }}
                    type="button"
                  >
                    <Undo2 className="size-4" />
                    되돌리기
                  </button>

                  <button
                    aria-label="다시 실행"
                    className={cn(
                      actionButtonClass,
                      'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={editorState.redoStack.length === 0}
                    onClick={() => {
                      dispatch({ type: 'redo' })
                      pushToast({
                        title: '다시 실행을 적용했습니다.',
                        description: '되돌린 변경을 다시 반영했습니다.',
                        tone: 'accent',
                      })
                    }}
                    type="button"
                  >
                    <Redo2 className="size-4" />
                    다시 실행
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'meta' })}
                    type="button"
                  >
                    <FolderInput className="size-4" />
                    기본 정보
                  </button>
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'lookups' })}
                    type="button"
                  >
                    분류표
                  </button>
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'materials' })}
                    type="button"
                  >
                    자료
                  </button>
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'events' })}
                    type="button"
                  >
                    <Files className="size-4" />
                    이벤트
                  </button>
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'raw' })}
                    type="button"
                  >
                    원본 JSON
                  </button>
                  <button
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium text-white/92 hover:bg-white/12',
                      'border-white/16 bg-white/6 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    disabled={!hasDraft}
                    onClick={() => setPanel({ type: 'placeholder' })}
                    type="button"
                  >
                    <BookOpen className="size-4" />
                    RC 문제 풀기
                  </button>
                </div>

                {!editorState.isDownloadable && hasDraft ? (
                  <p className="text-sm leading-6 text-blue-50/80">
                    차단 오류가 남아 있으면 다운로드를 막고, 로컬 드래프트만 계속
                    저장합니다.
                  </p>
                ) : null}
                {workspaceId ? (
                  <p className="text-sm leading-6 text-blue-50/80">
                    현재 작업 워크스페이스: {workspaceId}
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          {loadAlert ? (
            <section
              className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-3">
                  <p className="text-sm font-semibold leading-6">{loadAlert.title}</p>
                  <ul className="space-y-2 text-sm leading-6">
                    {loadAlert.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-sm leading-6">{loadAlert.hint}</p>
                </div>
              </div>
            </section>
          ) : null}

          {draftBlockingAlert ? (
            <section
              className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <div className="space-y-3">
                  <p className="text-sm font-semibold leading-6">
                    {draftBlockingAlert.title}
                  </p>
                  <ul className="space-y-2 text-sm leading-6">
                    {draftBlockingAlert.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p className="text-sm leading-6">{draftBlockingAlert.hint}</p>
                </div>
              </div>
            </section>
          ) : null}

          {!draftBlockingAlert && editorState.warnings.length > 0 ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-950 shadow-sm">
              <div className="space-y-3">
                <p className="text-sm font-semibold leading-6">
                  검증 경고 {editorState.warnings.length}건이 있습니다.
                </p>
                <ul className="space-y-2 text-sm leading-6">
                  {editorState.warnings.map((issue) => (
                    <li key={`${issue.code}-${issue.message}`}>{issue.message}</li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}

          {viewModel ? (
            <DashboardSections
              loadedDocument={loadedDocument as LoadedDocument}
              onOpenEvent={(eventId) => setPanel({ type: 'event', eventId })}
              onOpenEvents={() => setPanel({ type: 'events' })}
              onOpenLookups={() => setPanel({ type: 'lookups' })}
              onOpenMaterials={() => setPanel({ type: 'materials' })}
              onOpenMeta={() => setPanel({ type: 'meta' })}
              onOpenRaw={() => setPanel({ type: 'raw' })}
            />
          ) : hasDraft ? (
            <EmptyDashboardState
              hasDraft
              message="현재 드래프트에 구조 오류가 있어 대시보드를 만들지 못했습니다. 상단 버튼으로 기본 정보, 분류표, 자료, 이벤트를 열어 수정해 주세요."
            />
          ) : (
            <EmptyDashboardState />
          )}
        </div>
      </main>

      <DetailDrawer
        onClose={() => setPanel(null)}
        open={panel !== null}
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
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-950 shadow-lg">
          드래프트와 대시보드를 다시 계산 중입니다.
        </div>
      ) : null}
    </>
  )
}
