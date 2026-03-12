# RC 모듈형 생성 환경

이 문서는 RC 보강 문제를 대량으로 만들어내기 위한 생성 환경의 기준 문서다.

## 기본 원칙
- RC 전용으로만 생성한다.
- 공식 앵커를 먼저 잡고, 그 위에서 extraction, transform, synthetic-lite 순으로만 확장한다.
- 실제 TOEIC 문제라고 주장하지 않는다.
- full RC section 자동 생성은 기본 기능에서 제외한다.

## Part 5 생성 모듈
- slot reaction bank
- grammar contrast bank
- workplace vocab/collocation bank

## Part 6 생성 모듈
- sentence insertion bank
- context completion bank
- coherence cue bank

## Part 7 생성 모듈
- evidence-location bank
- paraphrase-matching bank
- genre-specific mini-passage bank

## 생성 허용 범위
- 공식 앵커 기반 재분류
- 형식 변환
- 짧은 synthetic-lite RC 보강 세트

## 생성 금지 범위
- 실제 TOEIC 문제라고 주장하는 생성물
- 공개문항/ETS 문항의 구조적 복제
- 전체 RC section 자동 복제
- 점수 추정

## 출력 계약
- `source_anchor`
- `target_part`
- `target_skill`
- `generation_mode`
- `difficulty`
- `answer_key`
- `rationale`
- `review_status: pending`

## 검수 규칙
- 최종 사용자 전달 전 `toeic-review-auditor`를 반드시 거친다.
- 판정이 `수정 필요`면 수정 후 다시 검수한다.
- 판정이 `폐기 권고`면 사용자에게 전달하지 않는다.

## 웹 연동 규칙
- 검수를 통과한 RC 드릴 세트만 `sync/toeic_web_sync.json`의 `materials.drill_sets`에 실을 수 있다.
- 드릴 세트를 웹으로 내보낼 때는 `drill_set.published` 파생 이벤트를 함께 남긴다.
- 공식 세트는 생성 대상이 아니라 읽기 전용 기준 자료다.
