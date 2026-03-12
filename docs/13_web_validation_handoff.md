# 웹 전용 스레드 전달 사항: RC sync 검증 강화

이 문서는 현재 스레드에서 직접 웹 구현을 하지 않고, 웹 전용 스레드가 그대로 받아서 작업할 수 있도록 정리한 handoff 문서다.

## 목표
- `sync/toeic_web_sync.json`의 안정성을 현재 프로젝트 규모에 맞게 강화한다.
- 과한 구조 변경 없이 `오류는 차단, 경고는 허용` 정책만 구현한다.
- 단일 JSON, 단일 revision, append-only events 구조는 유지한다.

## 구현 대상 파일
- `WEB/src/lib/sync-schema.ts`
- `WEB/src/lib/sync-view-model.ts`
- `WEB/src/components/DashboardSections.tsx`
- 필요 시 테스트 파일

## 구현 순서
1. `sync-schema.ts`
   - 느슨한 string 필드 중 고정 가능한 값은 enum 또는 literal로 강화
   - RC 범위를 벗어나는 값은 구조 단계에서 최대한 차단
2. semantic validator 추가
   - 별도 함수 또는 별도 lib 파일로 구현
   - 구조는 맞지만 운영상 위험한 상태를 검사
3. view model 연결
   - 차단 오류 목록
   - 허용 경고 목록
   - stale 여부
   - unknown event 여부
   - soft limit 초과 여부
4. UI 노출
   - 로드 실패 시 오류 목록 표시
   - 로드 성공 시 경고 목록 표시
   - 기존 무결성 카드에 오류 수, 경고 수, stale 여부, unknown event 여부 추가
5. 테스트 추가

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
- 파일 크기 `5 MB` 초과
- 이벤트 수 `1,500` 초과

## 비도입 항목
- cryptographic hash
- multi-file sync
- 자동 compaction
- 병합 엔진
- 추가 백업 파일 운영
- schema version bump

## 테스트 체크리스트
- 잘못된 `scope`는 차단
- 잘못된 `schema_version`은 차단
- duplicate `event_id`는 차단
- 잘못된 `actor/event_type` 조합은 차단
- 존재하지 않는 `source_set_id`는 차단
- lookup 바깥 분류값은 차단
- `meta.event_count` 불일치는 경고
- unknown future event는 경고
- stale revision은 경고
- 현재 샘플 `sync/toeic_web_sync.json`은 그대로 통과

## 구현 원칙
- 현재 프로젝트는 사용자 1명, 사용 기간 최대 1개월, 서버 없음
- 목표는 대형 시스템 수준 복구가 아니라 `깨진 파일을 빨리 발견`하는 것이다
- 따라서 구조를 복잡하게 만들지 말고, 지금 있는 업로드/시각화 흐름 위에 검증만 얹는다
