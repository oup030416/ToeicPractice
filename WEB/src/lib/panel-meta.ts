import type { DetailPanelState, LoadedDocument } from '../App'
import { formatNumber } from './format'
import type { EventCardView } from './sync-view-model'

export function buildPanelTitle(
  panel: DetailPanelState,
  selectedEvent: EventCardView | null,
) {
  if (panel?.type === 'event' && selectedEvent) {
    return selectedEvent.title
  }

  if (panel?.type === 'events') {
    return '전체 이벤트'
  }

  if (panel?.type === 'lookups') {
    return 'Taxonomy / Lookups'
  }

  if (panel?.type === 'materials') {
    return 'Materials 상세'
  }

  if (panel?.type === 'raw') {
    return '원본 JSON'
  }

  if (panel?.type === 'placeholder') {
    return 'RC 문제 풀기'
  }

  return '상세패널'
}

export function buildPanelSubtitle(
  panel: DetailPanelState,
  loadedDocument: LoadedDocument | null,
  filteredEventsCount: number,
) {
  if (!panel || !loadedDocument) {
    return undefined
  }

  if (panel.type === 'events') {
    return `총 ${formatNumber(loadedDocument.syncData.events.length)}개 중 ${formatNumber(filteredEventsCount)}개 표시`
  }

  if (panel.type === 'raw') {
    return '업로드한 포맷을 수정하지 않고 그대로 보여줍니다.'
  }

  if (panel.type === 'lookups') {
    return 'lookups 블록의 전체 taxonomy를 노출합니다.'
  }

  if (panel.type === 'materials') {
    return '공식 세트와 드릴 세트를 분리해 표시합니다.'
  }

  if (panel.type === 'placeholder') {
    return '버튼만 연결된 준비 중 패널'
  }

  return undefined
}
