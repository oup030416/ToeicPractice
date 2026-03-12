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
    return `총 ${formatNumber(loadedDocument.syncData.events.length)}개 중 ${formatNumber(filteredEventsCount)}개를 표시합니다.`
  }

  if (panel.type === 'raw') {
    return '현재 로컬 드래프트에서 다시 생성한 JSON 결과를 읽기 전용으로 보여줍니다.'
  }

  if (panel.type === 'lookups') {
    return 'lookups 블록 배열과 taxonomy를 우측 패널에서 수정합니다.'
  }

  if (panel.type === 'materials') {
    return '공식 세트와 드릴 세트를 분리해 보여주고, 각 항목을 수정하거나 삭제합니다.'
  }

  if (panel.type === 'meta') {
    return 'meta 블록의 핵심 필드를 수정하거나 삭제할 수 있습니다.'
  }

  if (panel.type === 'placeholder') {
    return '버튼만 연결된 준비 중 패널입니다.'
  }

  return undefined
}
