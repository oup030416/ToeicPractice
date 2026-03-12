# RC 웹 연동 단일 교환 파일 규격

이 문서는 현재 프로젝트와 별도 웹사이트가 하나의 JSON 파일만 주고받기 위한 RC 전용 v1 규격 문서다.

## 기본 원칙
- 교환 파일 이름은 `sync/toeic_web_sync.json`으로 고정한다.
- 인코딩은 `UTF-8`이다.
- 최상위 구조는 `meta`, `lookups`, `materials`, `events` 4블록만 허용한다.
- 범위는 RC 전용이며 `Part 5`, `Part 6`, `Part 7`만 허용한다.
- 이벤트는 append-only다. 기존 이벤트를 수정하거나 삭제하지 않는다.
- 웹사이트는 원시 이벤트만 쓴다.
- Codex는 파생 이벤트만 쓴다.

## 최상위 구조

```json
{
  "meta": {},
  "lookups": {},
  "materials": {},
  "events": []
}
```

## meta 규격
- `workspace_id`: 현재 학습 프로젝트 식별자
- `schema_version`: 항상 `toeic-web-sync/v1`
- `scope`: 항상 `rc`
- `revision`: 현재 파일 revision
- `previous_revision`: 직전 승인 revision
- `exported_at`: ISO 8601 문자열
- `exported_by`: `web` 또는 `codex`
- `event_count`: `events` 배열 개수
- `materials_revision`: 자료 집합이 바뀔 때만 올리는 별도 revision

## lookups 규격
- `parts`: `Part 5`, `Part 6`, `Part 7`
- `question_types`: 파트별 문제 유형 taxonomy
- `skill_tags`: 내부 분석용 세부 태그
- `vocab_domains`: RC 어휘 도메인 taxonomy
- `document_genres`: RC 문서 장르 taxonomy
- `error_types`: `grammar`, `vocabulary`, `paraphrase`, `connect-info`, `inference`, `evidence-location`, `time-pressure`, `mixed`
- `review_states`: `new`, `reviewed`, `repeated`, `stabilized`
- `recommendation_strengths`: `low`, `medium`, `high`, `critical`

## materials 규격

### official_sets
- 실제 공식 RC 세트
- 원문 전체 포함 허용
- 웹에서는 읽기 전용
- 각 세트 필드:
  - `set_id`
  - `title`
  - `source_anchor`
  - `source_type`: 항상 `official`
  - `region`: 항상 `KR`
  - `part`
  - `document_genre`
  - `passages`
  - `items`
  - `imported_at`
  - `notes`

### drill_sets
- Codex가 만든 synthetic-lite 또는 변형 RC 세트
- 각 세트 필드:
  - `set_id`
  - `title`
  - `source_anchor`
  - `generation_mode`
  - `target_part`
  - `target_skill`
  - `difficulty`
  - `items`
  - `answer_key`
  - `rationale`
  - `review_status`
  - `published_at`

## events 공통 규격
- `event_id`
- `timestamp`
- `actor`: `web` 또는 `codex`
- `event_type`
- `entity_type`
- `entity_id`
- `session_id`
- `attempt_id`
- `payload`
- `supersedes_event_id`

## 웹 전용 이벤트 타입
- `session.recorded`
- `attempt.recorded`
- `study_note.recorded`
- `rc_item.answered`
- `drill_item.answered`
- `raw_record.corrected`

## Codex 전용 이벤트 타입
- `qna.linked`
- `concept.promoted`
- `review.enqueued`
- `rc_weakness.recomputed`
- `recommendation.published`
- `dashboard.published`
- `drill_set.published`
- `sync.accepted`

## 핵심 payload 규격

### rc_item.answered
- `source_set_id`
- `source_kind`: `official` 또는 `drill`
- `question_no`
- `question_type`
- `skill_tag`
- `vocab_domain`
- `document_genre`
- `selected_answer`
- `correct_answer`
- `result`: `correct / wrong / uncertain`
- `error_type`
- `time_pressure`: `none / weak / strong`
- `note`

### attempt.recorded
- `material_name`
- `source_anchor`
- `part`
- `skill_tag`
- `topic`
- `question_count`
- `correct_count`
- `accuracy`
- `time_pressure`
- `next_action`

### qna.linked
- `qna_id`
- `item_id`
- `link_reason`

### rc_weakness.recomputed
- `registry`
  - 각 항목 필드:
    - `part`
    - `skill_tag`
    - `vocab_domain`
    - `attempt_count`
    - `wrong_count`
    - `accuracy`
    - `repeat_confusion_count`
    - `latest_exposure`
    - `priority_score`
    - `status`

### recommendation.published
- `recommendations`
  - 각 항목 필드:
    - `slot`
    - `what`
    - `why`
    - `evidence`
    - `strength`

### dashboard.published
- `project_status`
- `recent_session`
- `recent_attempt`
- `rc_focus`
- `repeated_confusions`
- `recent_improvement_signals`

## ownership 규칙
- 웹사이트는 `materials.official_sets`의 원문을 수정하지 않는다.
- 웹사이트는 원시 기록과 풀이 결과만 이벤트로 추가한다.
- Codex는 내부 Markdown 원장을 기준으로 약점, 추천, 대시보드, Q&A 링크 같은 파생 이벤트를 추가한다.
- 웹사이트는 파생 이벤트를 시각화하지만 직접 수정하지 않는다.

## revision 규칙
- 새 export는 항상 `revision = previous revision + 1`
- import 시 전달된 파일의 `previous_revision`이 마지막 승인 revision과 다르면 `stale file`로 간주한다.
- 중복 `event_id`는 무시한다.
- 정정은 덮어쓰기가 아니라 `raw_record.corrected`와 `supersedes_event_id`로 표현한다.

## 경량 안정성 정책
- 현재 프로젝트는 사용자 1명, 사용 기간 최대 1개월, 서버 없는 로컬 교환 구조를 전제로 한다.
- 따라서 복잡한 복구 장치보다 `빨리 깨짐을 발견하는 검증`을 우선한다.
- 정책은 `오류는 차단, 경고는 허용`으로 고정한다.

## 차단 오류
- JSON 파싱 실패
- top-level 필수 블록 누락
- `scope != rc`
- `schema_version != toeic-web-sync/v1`
- `Part 5`, `Part 6`, `Part 7` 이외 파트 사용
- 중복 `event_id`
- `actor`와 `event_type` ownership 위반
- `rc_item.answered`, `drill_item.answered`의 `source_set_id`가 실제 세트에 없음
- `supersedes_event_id`가 존재하지 않음
- 공식 세트 필수 필드 누락
- lookup 바깥 `question_type`, `vocab_domain`, `document_genre`, `error_type` 사용

## 허용 경고
- `meta.event_count`와 실제 이벤트 수 불일치
- 알 수 없는 미래 이벤트 타입 존재
- `previous_revision`이 마지막 accepted revision보다 오래됨
- raw 이벤트 이후 최신 `dashboard.published` 또는 `recommendation.published`가 오래됨
- 파일 크기 또는 이벤트 수가 soft limit 초과

## soft limit
- 파일 크기 `5 MB` 초과 시 경고
- 이벤트 수 `1,500` 초과 시 경고
- 현재 단계에서는 경고만 하고, 파일 분할이나 압축은 도입하지 않는다.

## 명시적 비도입 항목
- cryptographic hash 무결성
- multi-file sync
- 자동 compaction
- 병합 엔진
- 추가 백업 파일 운영
- schema version bump

## 금지 규칙
- LC 파트나 LC 전용 분류를 넣지 않는다.
- 정답 점수 추정값을 넣지 않는다.
- 웹이 약점 점수, 추천 강도, 개념 카드 상태를 직접 수정하지 않는다.
