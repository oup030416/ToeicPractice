# RC 웹 동기화 워크플로

이 문서는 `sync/toeic_web_sync.json`을 웹사이트와 현재 프로젝트 사이에서 어떻게 가져오고 내보내는지 설명한다.

## 기본 역할 분리
- 웹사이트:
  - 시각화
  - 공식 RC 세트 표시
  - 드릴 표시
  - 풀이 결과 입력
  - 학습 메모 입력
- 현재 프로젝트:
  - JSON 검증
  - 새 이벤트 diff 분석
  - 내부 Markdown 원장 반영
  - RC 약점 집계
  - 추천 계산
  - 대시보드 반영
  - 새 파생 이벤트 export

## 검증 정책
- 웹 로드 단계는 `오류는 차단, 경고는 허용` 정책을 따른다.
- 현재 프로젝트의 import 단계는 웹보다 더 엄격하게 동작한다.
- stale revision은 웹에서는 경고로 열람 가능하지만, 현재 프로젝트 반영 단계에서는 차단한다.

## 웹 -> 프로젝트 가져오기
1. 사용자가 웹사이트에서 내려받은 `toeic_web_sync.json`을 전달한다.
2. `meta.workspace_id`, `schema_version`, `scope`, `revision`, `previous_revision`을 확인한다.
3. `scope`가 `rc`가 아니면 중단한다.
4. 마지막 승인본의 revision과 비교한다.
5. `previous_revision`이 맞지 않으면 `stale file`로 처리하고 자동 병합하지 않는다.
6. 기존 승인본에 없는 `event_id`만 새 이벤트로 추출한다.
7. 새 이벤트를 타입별로 분류한다.
8. 중복 `event_id`는 경고 후 무시한다.
9. 아래 순서로 내부 원장에 반영한다.
   - `attempt.recorded` -> `logs/attempts/`
   - `session.recorded` -> `logs/sessions/`
   - `rc_item.answered` / `drill_item.answered` -> `tracking/rc_item_ledger.md`
   - `study_note.recorded` -> 관련 세션 또는 시도 메모
   - `raw_record.corrected` -> supersede 메모와 함께 관련 원장 갱신
10. 반영 뒤 `tracking/rc_weakness_registry.md`를 다시 계산한다.
11. `tracking/progress_dashboard.md`를 갱신한다.
12. 필요하면 `tracking/review_queue.md`, `tracking/qna_master_log.md`, `knowledge/concept_index.md`를 함께 갱신한다.
13. 마지막에 Codex 파생 이벤트를 같은 JSON에 추가한다.
14. 사용자에게는 이번 import에서 `반영된 이벤트 수 / 무시된 이벤트 수 / 경고 수`를 함께 요약한다.

## 프로젝트 -> 웹 내보내기
1. 현재 프로젝트의 최신 상태를 읽는다.
2. `tracking/rc_weakness_registry.md` 기준으로 `rc_weakness.recomputed`를 만든다.
3. `tracking/progress_dashboard.md` 기준으로 `dashboard.published`를 만든다.
4. 최신 RC 추천 3개를 `recommendation.published`로 만든다.
5. 새 드릴이 있으면 `materials.drill_sets`와 `drill_set.published`를 갱신한다.
6. revision을 1 올리고 `previous_revision`을 직전 revision으로 기록한다.
7. `event_count`를 다시 계산한다.
8. 갱신된 파일을 사용자가 웹사이트에 업로드한다.

## 반영 매핑
- `session.recorded` -> 세션 로그
- `attempt.recorded` -> 시도 로그
- `rc_item.answered` -> RC 문항 원장
- `qna.linked` -> Q&A 로그와 RC 문항 연결
- `concept.promoted` -> 개념 카드 승격 추적
- `review.enqueued` -> 복습 큐 반영
- `rc_weakness.recomputed` -> RC 약점 레지스트리
- `recommendation.published` -> 추천 스냅샷과 대시보드 추천
- `dashboard.published` -> 진행 대시보드

## 충돌 처리
- 오래된 revision 파일은 자동 병합하지 않는다.
- 중복 `event_id`는 경고 후 무시한다.
- 같은 원시 기록을 고칠 때는 기존 이벤트를 지우지 않고 `raw_record.corrected`를 추가한다.
- 공식 세트 원문은 웹에서 수정하지 않는다.

## 과도한 조치 배제
- 현재 단계에서는 해시 무결성, 자동 압축, multi-file sync, 자동 compaction, 병합 엔진, 추가 백업 파일 운영을 도입하지 않는다.
- 파일이 커져도 우선은 경고와 검증 강화로 대응하고, 구조 자체는 유지한다.

## v1 운영 규칙
- 현재 교환 파일은 RC 전용이다.
- 공식 세트는 읽기 전용이다.
- 웹은 원시 이벤트만 쓴다.
- Codex는 파생 이벤트만 쓴다.
- 내부 장기 기록은 Markdown 원장이 계속 맡는다.

## v1 완료 조건
- 웹에서 풀이 결과를 추가한 파일을 가져와도 시도 기록, RC 문항 원장, RC 약점 레지스트리, 대시보드가 모두 이어져야 한다.
- 프로젝트에서 다시 내보낸 파일을 웹이 읽으면 최신 RC 추천과 약점 현황이 그대로 보존되어야 한다.
