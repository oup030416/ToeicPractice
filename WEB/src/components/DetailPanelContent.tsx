import { Search } from 'lucide-react'

import type { DetailPanelState, LoadedDocument } from '../App'
import { getValueAtPath, type EditableDocumentState } from '../lib/editor-state'
import { formatDateTime, formatNumber } from '../lib/format'
import type { EventCardView } from '../lib/sync-view-model'
import { Badge } from './Badge'
import { EmptyMessage, InfoRow } from './DashboardBlocks'
import type { CommitMessage } from './detail-editor-types'
import { buildFallbackEventCards, asArray } from './editor-utils'
import { EventEditor } from './EventEditor'
import { LookupsEditor } from './LookupsEditor'
import { MaterialsEditor } from './MaterialsEditor'
import { MetaEditor } from './MetaEditor'

export function DetailPanelContent({
  panel,
  loadedDocument,
  editorState,
  selectedEvent,
  filteredEvents,
  eventQuery,
  onEventQueryChange,
  onOpenEvent,
  onCommitDraftChange,
}: {
  panel: DetailPanelState
  loadedDocument: LoadedDocument | null
  editorState: EditableDocumentState
  selectedEvent: EventCardView | null
  filteredEvents: EventCardView[]
  eventQuery: string
  onEventQueryChange: (value: string) => void
  onOpenEvent: (eventId: string) => void
  onCommitDraftChange: (nextPresent: unknown, message: CommitMessage) => void
}) {
  if (!editorState.present) {
    return <EmptyMessage text="먼저 JSON 파일을 업로드해 주세요." />
  }

  const fallbackEventCards = buildFallbackEventCards(
    asArray(getValueAtPath(editorState.present, ['events'])),
  )
  const visibleEvents = loadedDocument?.viewModel
    ? filteredEvents
    : fallbackEventCards.filter((event) =>
        event.searchableText.includes(eventQuery.trim().toLowerCase()),
      )

  if (panel?.type === 'meta') {
    return (
      <MetaEditor
        draft={editorState.present}
        key={`meta-${editorState.rawText.length}-${editorState.savedAt ?? 'none'}`}
        onCommitDraftChange={onCommitDraftChange}
      />
    )
  }

  if (panel?.type === 'event') {
    return (
      <EventEditor
        draft={editorState.present}
        eventId={selectedEvent?.id ?? panel.eventId}
        key={`event-${selectedEvent?.id ?? panel.eventId}-${editorState.savedAt ?? 'none'}`}
        onCommitDraftChange={onCommitDraftChange}
      />
    )
  }

  if (panel?.type === 'events') {
    return (
      <div className="space-y-5">
        <label className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
          <Search className="size-4 text-slate-500" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
            onChange={(event) => onEventQueryChange(event.target.value)}
            placeholder="이벤트 유형, 엔터티 ID, payload 텍스트 검색"
            type="search"
            value={eventQuery}
          />
        </label>
        <p className="text-sm leading-6 text-slate-500">
          현재 {formatNumber(visibleEvents.length)}개 이벤트를 표시 중입니다.
        </p>
        <div className="space-y-3">
          {visibleEvents.map((event) => (
            <button
              className="w-full rounded-3xl border border-slate-200 p-4 text-left hover:border-blue-300 hover:bg-blue-50"
              key={event.id}
              onClick={() => onOpenEvent(event.id)}
              type="button"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone={event.tone}>{event.eventType}</Badge>
                <Badge>{event.actor}</Badge>
              </div>
              <p className="font-medium text-slate-950">{event.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{event.description}</p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (panel?.type === 'lookups') {
    return (
      <LookupsEditor
        draft={editorState.present}
        key={`lookups-${editorState.savedAt ?? 'none'}`}
        onCommitDraftChange={onCommitDraftChange}
      />
    )
  }

  if (panel?.type === 'materials') {
    return (
      <MaterialsEditor
        draft={editorState.present}
        key={`materials-${editorState.savedAt ?? 'none'}`}
        onCommitDraftChange={onCommitDraftChange}
      />
    )
  }

  if (panel?.type === 'raw') {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="드래프트 저장 시각" value={formatDateTime(editorState.savedAt)} />
          <InfoRow
            label="현재 다운로드 가능 여부"
            value={editorState.isDownloadable ? '가능' : '차단'}
          />
        </div>
        <pre className="overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
          {editorState.rawText}
        </pre>
      </div>
    )
  }

  if (panel?.type === 'placeholder') {
    return (
      <div className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-slate-900">
        <Badge tone="accent">준비 중</Badge>
        <p className="font-medium">RC 문제 풀기 상세 UI는 아직 구현하지 않았습니다.</p>
        <p className="text-sm leading-6 text-slate-700">
          이번 단계에서는 진입 버튼과 준비 중 패널만 제공합니다. 이후 Part 5/6/7
          문항 표시, 응답 입력, 타이머, 정답 대조, 이벤트 기록 작성 계층을 이 패널
          기준으로 확장합니다.
        </p>
      </div>
    )
  }

  return <EmptyMessage text="표시할 상세 데이터가 없습니다." />
}
