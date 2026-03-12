import type { DetailPanelState, LoadedDocument } from '../App'
import { formatNumber } from './format'
import type { EventCardView } from './sync-view-model'

export function buildPanelTitle(
  panel: DetailPanelState,
  selectedEvent: EventCardView | null,
) {
  if (panel?.type === 'meta') {
    return '기본 정보 편집'
  }

  if (panel?.type === 'event' && selectedEvent) {
    return selectedEvent.title
  }

  if (panel?.type === 'events') {
    return '전체 이벤트'
  }

  if (panel?.type === 'lookups') {
    return '전체 분류표'
  }

  if (panel?.type === 'materials') {
    return '자료 상세'
  }

  if (panel?.type === 'raw') {
    return '원본 JSON'
  }

  return '상세 화면'
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
    return `전체 ${formatNumber(loadedDocument.syncData.events.length)}개 중 ${formatNumber(filteredEventsCount)}개를 표시합니다.`
  }

  if (panel.type === 'raw') {
    return '현재 로컬 드래프트를 다시 직렬화한 JSON 결과를 읽기 전용으로 보여줍니다.'
  }

  if (panel.type === 'lookups') {
    return 'lookups 블록과 taxonomy를 한곳에서 수정합니다.'
  }

  if (panel.type === 'materials') {
    return '공식 세트와 드릴 세트를 나누어 보여주고, 항목 수정과 삭제를 처리합니다.'
  }

  if (panel.type === 'meta') {
    return 'meta 블록의 필드를 수정하고 필요하면 삭제할 수 있습니다.'
  }

  return undefined
}
