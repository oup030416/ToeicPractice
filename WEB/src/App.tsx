import { BookOpen, Download, Files, TriangleAlert, Upload } from 'lucide-react'
import {
  useDeferredValue,
  useEffect,
  useId,
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
import { cn, slugifyFileName } from './lib/format'
import { buildPanelSubtitle, buildPanelTitle } from './lib/panel-meta'
import { safeParseToeicWebSyncText, type ToeicWebSyncV1 } from './lib/sync-schema'
import { loadStoredSyncDocument, saveStoredSyncDocument } from './lib/storage'
import {
  buildDashboardViewModel,
  type DashboardViewModel,
  type EventCardView,
} from './lib/sync-view-model'

export interface LoadedDocument {
  syncData: ToeicWebSyncV1
  viewModel: DashboardViewModel
  rawText: string
  fileName: string | null
  savedAt: string
  source: 'upload' | 'restore'
}

export type DetailPanelState =
  | { type: 'event'; eventId: string }
  | { type: 'lookups' }
  | { type: 'materials' }
  | { type: 'raw' }
  | { type: 'events' }
  | { type: 'placeholder' }
  | null

const actionButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold'

let nextToastId = 1

function createLoadedDocument(
  syncData: ToeicWebSyncV1,
  rawText: string,
  fileName: string | null,
  savedAt: string,
  source: LoadedDocument['source'],
): LoadedDocument {
  return {
    syncData,
    viewModel: buildDashboardViewModel(syncData),
    rawText,
    fileName,
    savedAt,
    source,
  }
}

function buildDownloadName(document: LoadedDocument) {
  const baseName = document.fileName?.replace(/\.json$/i, '')

  if (baseName) {
    return `${baseName}.json`
  }

  return `${slugifyFileName(document.syncData.meta.workspace_id)}-r${document.syncData.meta.revision}.json`
}

export default function App({
  initialDocument = null,
}: {
  initialDocument?: LoadedDocument | null
}) {
  const fileInputId = useId()
  const hydrateRef = useRef(false)
  const [loadedDocument, setLoadedDocument] = useState<LoadedDocument | null>(
    initialDocument,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [panel, setPanel] = useState<DetailPanelState>(null)
  const [eventQuery, setEventQuery] = useState('')
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [isPending, startDashboardTransition] = useTransition()
  const deferredEventQuery = useDeferredValue(eventQuery, '')

  function dismissToast(id: number) {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }

  function pushToast(toast: Omit<ToastItem, 'id'>) {
    const id = nextToastId++
    setToasts((current) => [...current, { ...toast, id }])
    window.setTimeout(() => dismissToast(id), 3200)
  }

  function commitDocument(
    syncData: ToeicWebSyncV1,
    rawText: string,
    fileName: string | null,
    source: LoadedDocument['source'],
  ) {
    const savedAt = new Date().toISOString()
    saveStoredSyncDocument({ rawText, fileName, savedAt })

    startDashboardTransition(() => {
      setLoadedDocument(
        createLoadedDocument(syncData, rawText, fileName, savedAt, source),
      )
      setPanel(null)
      setEventQuery('')
      setErrorMessage(null)
    })
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const rawText = await file.text()
    const parsed = safeParseToeicWebSyncText(rawText)

    if (!parsed.success) {
      setErrorMessage(parsed.message)
      pushToast({
        title: '업로드에 실패했습니다.',
        description: parsed.message,
        tone: 'danger',
      })
      event.target.value = ''
      return
    }

    commitDocument(parsed.data, rawText, file.name, 'upload')
    pushToast({
      title: 'JSON을 불러왔습니다.',
      description: file.name,
      tone: 'success',
    })
    event.target.value = ''
  }

  function handleDownload() {
    if (!loadedDocument) {
      return
    }

    downloadTextFile(
      buildDownloadName(loadedDocument),
      loadedDocument.rawText,
      'application/json;charset=utf-8',
    )

    pushToast({
      title: '현재 데이터를 다운로드했습니다.',
      description: buildDownloadName(loadedDocument),
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

    const storedDocument = loadStoredSyncDocument()

    if (!storedDocument) {
      return
    }

    const parsed = safeParseToeicWebSyncText(storedDocument.rawText)

    if (!parsed.success) {
      setErrorMessage(parsed.message)
      const id = nextToastId++
      setToasts((current) => [
        ...current,
        {
          id,
          title: '이전 로컬 데이터를 복원하지 못했습니다.',
          description: parsed.message,
          tone: 'danger',
        },
      ])
      window.setTimeout(() => dismissToast(id), 3200)
      return
    }

    startDashboardTransition(() => {
      setLoadedDocument(
        createLoadedDocument(
          parsed.data,
          storedDocument.rawText,
          storedDocument.fileName,
          storedDocument.savedAt,
          'restore',
        ),
      )
    })

    {
      const id = nextToastId++
      setToasts((current) => [
        ...current,
        {
          id,
          title: '최근 업로드본을 복원했습니다.',
          description: storedDocument.fileName ?? 'localStorage 저장본',
          tone: 'brand',
        },
      ])
      window.setTimeout(() => dismissToast(id), 3200)
    }
  }, [initialDocument, startDashboardTransition])

  const viewModel = loadedDocument?.viewModel ?? null
  const selectedEvent: EventCardView | null =
    panel?.type === 'event'
      ? loadedDocument?.viewModel.allEvents.find((event) => event.id === panel.eventId) ??
        null
      : null
  const filteredEvents = loadedDocument
    ? loadedDocument.viewModel.allEvents.filter((event) =>
        event.searchableText.includes(deferredEventQuery.trim().toLowerCase()),
      )
    : []

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
                    정적 클라이언트
                  </Badge>
                  {viewModel ? (
                    <Badge
                      className="bg-emerald-300 text-slate-950 ring-emerald-200"
                      tone="success"
                    >
                      revision {viewModel.meta.revision}
                    </Badge>
                  ) : null}
                </div>
                <div className="space-y-3">
                  <h1 className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
                    RC 웹 연동 JSON을 읽고,
                    <br />
                    핵심 신호만 먼저 보여주는 대시보드
                  </h1>
                  <p className="max-w-2xl text-base leading-7 text-blue-50/90 sm:text-lg">
                    업로드한 `toeic_web_sync.json`을 검증한 뒤 추천, 약점, 이벤트,
                    taxonomy를 한국어 UI로 시각화합니다.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:w-[32rem]">
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
                  disabled={!loadedDocument}
                  onClick={handleDownload}
                  type="button"
                >
                  <Download className="size-4" />
                  현재 JSON 다운로드
                </button>

                <button
                  className={cn(
                    actionButtonClass,
                    'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                  disabled={!loadedDocument}
                  onClick={() => setPanel({ type: 'events' })}
                  type="button"
                >
                  <Files className="size-4" />
                  전체 이벤트 보기
                </button>

                <button
                  className={cn(
                    actionButtonClass,
                    'border-white/18 bg-slate-950/35 text-white hover:bg-slate-950/55 disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                  disabled={!loadedDocument}
                  onClick={() => setPanel({ type: 'placeholder' })}
                  type="button"
                >
                  <BookOpen className="size-4" />
                  RC 문제 풀기
                </button>
              </div>
            </div>
          </header>

          {errorMessage ? (
            <section
              className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-rose-950 shadow-sm"
              role="alert"
            >
              <p className="flex items-start gap-3 text-sm leading-6">
                <TriangleAlert className="mt-0.5 size-5 shrink-0" />
                <span>{errorMessage}</span>
              </p>
            </section>
          ) : null}

          {viewModel ? (
            <DashboardSections
              loadedDocument={loadedDocument as LoadedDocument}
              onOpenEvent={(eventId) => setPanel({ type: 'event', eventId })}
              onOpenEvents={() => setPanel({ type: 'events' })}
              onOpenLookups={() => setPanel({ type: 'lookups' })}
              onOpenMaterials={() => setPanel({ type: 'materials' })}
              onOpenRaw={() => setPanel({ type: 'raw' })}
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
          eventQuery={eventQuery}
          filteredEvents={filteredEvents}
          loadedDocument={loadedDocument}
          onEventQueryChange={setEventQuery}
          onOpenEvent={(eventId) => setPanel({ type: 'event', eventId })}
          panel={panel}
          selectedEvent={selectedEvent}
        />
      </DetailDrawer>

      <ToastStack toasts={toasts} />

      {isPending ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-blue-200 bg-white/95 px-4 py-2 text-sm font-medium text-blue-950 shadow-lg">
          데이터 집계를 정리 중입니다.
        </div>
      ) : null}
    </>
  )
}
