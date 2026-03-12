import { Search } from 'lucide-react'

import type { DetailPanelState, LoadedDocument } from '../App'
import { Badge } from './Badge'
import { EmptyMessage, InfoRow, MaterialSection } from './DashboardBlocks'
import { formatDateTime, formatNumber, safePrettyJson } from '../lib/format'
import type { EventCardView } from '../lib/sync-view-model'

export function DetailPanelContent({
  panel,
  loadedDocument,
  selectedEvent,
  filteredEvents,
  eventQuery,
  onEventQueryChange,
  onOpenEvent,
}: {
  panel: DetailPanelState
  loadedDocument: LoadedDocument | null
  selectedEvent: EventCardView | null
  filteredEvents: EventCardView[]
  eventQuery: string
  onEventQueryChange: (value: string) => void
  onOpenEvent: (eventId: string) => void
}) {
  if (!loadedDocument) {
    return <EmptyMessage text="먼저 JSON 파일을 업로드해 주세요." />
  }

  const viewModel = loadedDocument.viewModel

  if (panel?.type === 'event' && selectedEvent) {
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={selectedEvent.tone}>{selectedEvent.eventType}</Badge>
          <Badge>{selectedEvent.actor}</Badge>
          <Badge>{selectedEvent.entityType}</Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow label="timestamp" value={formatDateTime(selectedEvent.timestamp)} />
          <InfoRow label="entity_id" value={selectedEvent.entityId} />
          <InfoRow label="session_id" value={selectedEvent.sessionId} />
          <InfoRow label="attempt_id" value={selectedEvent.attemptId} />
        </div>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="font-medium text-slate-900">{selectedEvent.description}</p>
        </div>
        <pre className="overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
          {safePrettyJson(selectedEvent.payload)}
        </pre>
      </div>
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
            placeholder="event_type, entity_id, payload 텍스트 검색"
            type="search"
            value={eventQuery}
          />
        </label>
        <p className="text-sm leading-6 text-slate-500">
          검색은 `useDeferredValue`로 지연 반영됩니다. 현재 {formatNumber(filteredEvents.length)}개 이벤트 표시 중입니다.
        </p>
        <div className="space-y-3">
          {filteredEvents.map((event) => (
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
      <div className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {viewModel.lookupSummary.map((item) => (
            <article
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              key={item.key}
            >
              <p className="text-sm text-slate-500">{item.key}</p>
              <p className="mt-2 font-mono text-2xl font-semibold text-slate-950">
                {formatNumber(item.count)}
              </p>
            </article>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {viewModel.lookupSections.map((section) => (
            <section className="rounded-3xl border border-slate-200 p-4" key={section.title}>
              <h3 className="font-medium text-slate-900">{section.title}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {section.items.map((item) => (
                  <Badge key={`${section.title}-${item}`}>{item}</Badge>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    )
  }

  if (panel?.type === 'materials') {
    return (
      <div className="space-y-6">
        <MaterialSection
          cards={viewModel.materialsSummary.officialCards}
          emptyText="공식 세트가 아직 비어 있습니다."
          title="Official Sets"
        />
        <MaterialSection
          cards={viewModel.materialsSummary.drillCards}
          emptyText="드릴 세트가 아직 비어 있습니다."
          title="Drill Sets"
        />
      </div>
    )
  }

  if (panel?.type === 'raw') {
    return (
      <pre className="overflow-auto rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-100">
        {loadedDocument.rawText}
      </pre>
    )
  }

  if (panel?.type === 'placeholder') {
    return (
      <div className="space-y-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-slate-900">
        <Badge tone="accent">준비 중</Badge>
        <p className="font-medium">RC 문제 풀기 상세 UI는 아직 구현하지 않았습니다.</p>
        <p className="text-sm leading-6 text-slate-700">
          이번 v1에서는 진입 버튼과 placeholder 패널만 제공합니다. 이후 Part 5/6/7
          문항 표시, 응답 입력, 타이머, 정답 대조, 이벤트 기록 작성 계층을 이 패널
          기준으로 확장합니다.
        </p>
      </div>
    )
  }

  return <EmptyMessage text="표시할 상세 데이터가 없습니다." />
}
