# RC 모의고사 풀이 운영 규칙

이 문서는 실제 RC 모의고사 문제를 풀면서 질문과 개념 학습을 반복하는 현재 사용자 방식에 맞춘 운영 규칙이다.

## 기본 루프
1. 사용자는 실제 RC 문제를 그대로 푼다.
2. 막히는 문항이 생기면 Q&A 스레드에서 바로 질문한다.
3. 답변을 받으며 개념, 규칙, 구분 포인트를 익힌다.
4. 관련 문항을 `tracking/rc_item_ledger.md`에 남긴다.
5. 오답 또는 불확실 문항은 `tracking/rc_weakness_registry.md`와 대시보드 추천에 반영한다.
6. 다시 문제를 풀고, 질문하고, 개념을 정리하는 루프를 반복한다.
7. 웹사이트를 사용했다면 마지막에 `sync/toeic_web_sync.json`을 최신 revision으로 정리해 왕복 상태를 맞춘다.

## 현재 스레드 역할
- 시도 기록 정리
- 문항 원장 반영
- 약점 레지스트리 갱신
- 대시보드 추천 갱신
- 필요 시 RC 드릴 요청
- 웹 교환 파일 import/export 정리

## Q&A 스레드 역할
- 막힌 문항에 대한 즉답
- 개념 카드 승격
- 반복 혼동 추적
- 복습 큐 반영

## 기록 단위

### 시도
- 한 세트, 한 파트 묶음, 한 지문 묶음 단위 요약
- 위치: `logs/attempts/`

### 문항 원장
- 문항 단위 세부 기록
- 위치: `tracking/rc_item_ledger.md`

### 약점 레지스트리
- 파트 + 하위능력 + 어휘도메인 단위 집계
- 위치: `tracking/rc_weakness_registry.md`

## RC 문항 결과값
- `result`: `correct / wrong / uncertain`
- `error_type`:
  - `grammar`
  - `vocabulary`
  - `paraphrase`
  - `connect-info`
  - `inference`
  - `evidence-location`
  - `time-pressure`
  - `mixed`
- `review_state`:
  - `new`
  - `reviewed`
  - `repeated`
  - `stabilized`

## 질문 반영 규칙
- 질문이 생긴 문항은 `wrong` 또는 `uncertain`으로 남긴다.
- 답변 후 개념이 반복 가치가 있으면 개념 카드로 승격한다.
- 같은 개념 질문이 3회 이상이면 `repeat_confusion_count`를 올리고 우선순위 강제 상향 후보로 넣는다.

## 추천 연결 규칙
- RC 추천은 항상 아래 셋으로만 정리한다.
  - `지금 가장 먼저 보강할 RC 항목`
  - `다음 세션에서 다시 볼 RC 항목`
  - `당장 보류할 RC 항목`
- 추천 근거는 반드시 아래 중 하나 이상을 포함한다.
  - 최근 정답률 부족
  - 같은 오류 반복
  - 반복 혼동 개념
  - 시간 압박
  - 같은 장르/어휘도메인 재붕괴

## 웹 연동 연결 규칙
- 웹에서 실제 풀이를 했다면 해당 변경은 `rc_item.answered`, `attempt.recorded`, `study_note.recorded` 같은 원시 이벤트로 먼저 들어온다.
- Codex는 이 이벤트를 내부 Markdown 원장으로 반영한 뒤 `rc_weakness.recomputed`, `recommendation.published`, `dashboard.published` 같은 파생 이벤트를 다시 쓴다.
- 공식 RC 세트는 웹에서 읽기 전용이다.
