# TOEIC WEB v1 디자인 시스템

검증 기준일: 2026-03-12

이 문서는 `ui-ux-pro-max` 결과를 바탕으로 TOEIC WEB v1에 고정 적용할 UI/UX 기준이다.

## 디자인 방향
- 패턴: Data-Dense + Drill-Down
- 스타일: Data-Dense Dashboard
- 원칙: 핵심 신호는 첫 화면, 저우선 데이터는 버튼 뒤 상세패널
- 금지: 과장된 장식, 무분별한 전체 데이터 노출, 다크 모드 우선 설계

## 토큰
- Primary: `#1E40AF`
- Secondary: `#3B82F6`
- Accent: `#F59E0B`
- Background: `#F8FAFC`
- Text: `#1E3A8A`
- Surface: `#FFFFFF`
- Surface-muted: `#EFF6FF`
- Danger: `#B91C1C`
- Success: `#047857`

## 타이포그래피
- Heading: Fira Code
- Body: Fira Sans
- 본문 최소 크기: 16px
- 숫자, revision, 코드성 텍스트는 monospace 우선

## 레이아웃 규칙
- 모바일 우선
- 기준 폭: 375 / 768 / 1024 / 1440
- 작은 화면: 1열 카드 + bottom sheet 상세패널
- 큰 화면: 2~3열 카드 + 우측 drawer 상세패널
- 가로 스크롤 금지. 예외는 데이터 표 wrapper 내부만 허용

## 상호작용 규칙
- 클릭 가능한 모든 요소는 명확한 hover/pressed/focus 상태 유지
- 전환 시간: 150-250ms
- Escape로 상세패널 닫기
- 키보드만으로 업로드, 다운로드, 상세 열기, RC 버튼 조작 가능해야 함

## 접근성 규칙
- 텍스트 대비 4.5:1 이상
- 색만으로 상태 전달 금지
- 오류 메시지는 `role="alert"` 사용
- `prefers-reduced-motion`에서 모션 축소

## 정보 구조 규칙
- 첫 화면 노출:
  - workspace meta
  - recommendation
  - dashboard focus
  - weakness summary
  - recent event timeline
  - materials summary
- 버튼 뒤 상세:
  - lookups taxonomy
  - full event list
  - raw JSON
  - 개별 payload 전체
