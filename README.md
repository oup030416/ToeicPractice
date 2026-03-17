# TOEIC 적응형 학습 워크스페이스

이 폴더는 TOEIC 학습 과정에서 나온 정보, 시도 기록, 반복 약점, Q&A 개념, 추천 근거를 저장하고 관리하기 위한 작업 공간이다. 목표는 고정 플랜 수행이 아니라, 개인 맞춤형 진척도 계산과 다음 학습 제안을 더 정확하게 만드는 것이다.

이 프로젝트는 공식 자료 중심으로 운영한다.
- 한국TOEIC위원회 공개문항
- ETS 응시자 핸드북
- ETS Sample Test
- 공식 자료가 부족할 때만 보조 자료를 `supplemental`로 명시

## 시작 순서
1. `docs/00_project_charter.md` 확인
2. `docs/01_verified_sources.md` 확인
3. `docs/03_study_system.md` 확인
4. `docs/04_adaptive_recommendation_model.md` 확인
5. `docs/05_skill_system.md` 확인
6. `docs/07_qna_thread_protocol.md` 확인
7. 문제 대량 생산이 필요하면 `docs/14_item_production_playbook.md` 확인
8. RC 웹 연동이 필요하면 `docs/11_web_exchange_spec.md`, `docs/12_web_sync_workflow.md` 확인
9. `tracking/progress_dashboard.md` 확인
10. 필요하면 `logs/sessions/`와 `logs/attempts/`에 새 기록 추가

## 폴더 구성
- `AGENTS.md`: 이 워크스페이스의 고정 운영 규칙
- `docs/`: 프로젝트 기준 문서
- `templates/`: 세션, 시도, 추천, Q&A, 어휘 자산 템플릿
- `tracking/`: 대시보드, 복습 큐, 전략 변경, 출처 확인 기록
- `knowledge/`: 반복 개념 카드와 어휘 자산
- `logs/sessions/`: 세션 기록
- `logs/attempts/`: 실제 풀이 및 시도 기록
- `sync/`: 웹사이트와 주고받는 단일 교환 파일
- `materials/`: 자료 보관 가이드와 개별 drill_set JSON 저장소

## Skill 계층
- 실제 Skill 파일은 `C:\Users\demel\.codex\skills\` 아래에 설치되어 있다.
- 운영 설명은 `docs/05_skill_system.md`에 정리되어 있다.
- OpenAI 및 Anthropic 공식 근거는 `docs/06_skill_official_basis.md`에 정리되어 있다.
- 빠른 질문용 별도 스레드는 `docs/07_qna_thread_protocol.md` 기준으로 운영한다.
- 문제 대량 생산 기준은 `docs/14_item_production_playbook.md`와 `templates/problem_batch_request_template.md`를 따른다.
- export 유틸은 루트 `package.json`의 `sync:export-drills` 명령으로 실행한다.
- drill_set 저장은 여러 파일 분할보다 기존 세트 JSON 누적 확장을 기본 원칙으로 한다.
- 사용자 지시 `json 작업 시작`은 현재 저장된 drill_set을 통합해 export 파일을 만드는 실행 신호로 취급한다.

## 운영 원칙
- 고정 일수나 고정 시간 목표를 강제하지 않는다.
- 기록 단위는 `세션`과 `시도`로 분리한다.
- 추천은 최근 시도 결과, 반복 혼동, Q&A 질문 누적, 시간 압박 여부를 함께 본다.
- 공식 점수 추정은 하지 않는다.
- 사용자에게 보이는 설명과 문서는 한국어로 유지한다.
- 웹사이트와 직접 주고받는 데이터 파일은 `sync/toeic_web_sync.json` 하나로 고정한다.
- 웹사이트는 원시 기록을 쓰고, Codex는 파생 데이터와 추천을 계산해 다시 파일에 반영한다.
- 현재 웹 연동 범위는 RC 전용 v1이다.

## 첫 실행
새 공부 흐름을 시작할 때는 `templates/session_log_template.md`를 기준으로 세션 기록을 만들고, 실제 풀이가 있었다면 `templates/attempt_record_template.md`를 함께 사용한다.
