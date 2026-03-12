# Skill 운영 체계

이 문서는 현재 TOEIC 프로젝트에서 Codex Skill을 어떻게 쓰는지 정리한 운영 문서다. Skill 자체는 `C:\Users\demel\.codex\skills\` 아래에 두고, 이 워크스페이스 문서는 계속 소스 오브 트루스로 유지한다.

## 구현 상태
- 구현 완료:
  - `codex-evidence-gate`
  - `toeic-study-orchestrator`
  - `toeic-template-workbench`
  - `toeic-review-auditor`
  - `toeic-drill-generator`
  - `toeic-qa-memory-desk`
- 보류:
  - `codex-prompt-eval-lab`

## Skill별 역할

| Skill | 역할 | 언제 쓰는가 | 출력 원칙 |
| --- | --- | --- | --- |
| `codex-evidence-gate` | 새 제안과 공식 사실 검증의 승인 게이트 | 새 자료 도입, 규칙 변경, 공식 사실 확인, 추천 지표 변경, 가치 판단 요청 | `목적 / 실제 효용 / 공식 근거 / 비용·복잡도 / 기본 상태 / 승인 질문` |
| `toeic-study-orchestrator` | 현재 프로젝트의 메인 컨트롤러 | 세션 시작, 시도 반영, 최근 기록 기반 추천, 대시보드 갱신 순서 결정 | 사용자 안내는 한국어, 프로젝트 문서 우선 |
| `toeic-template-workbench` | 사용자용 템플릿과 양식 설계 | 세션 템플릿, 시도 기록 양식, 추천 스냅샷, 어휘 카드 양식 생성/수정 | 설명은 한국어, 예문과 문제 요소만 영어 |
| `toeic-review-auditor` | 품질 검수 게이트 | 드릴, 템플릿, 전략, 합성 콘텐츠, 진단표 검수 | `통과 / 수정 필요 / 폐기 권고` |
| `toeic-drill-generator` | 제한된 TOEIC 보강 드릴 생성 | 우선순위 높은 약점 보강 드릴, 패러프레이즈 훈련, 표현 묶음 재구성 | 공식 자료 앵커 필수, 검수 대기 상태로 생성 |
| `toeic-qa-memory-desk` | 빠른 질문과 메모리 반영 | 막히는 개념 질문, 짧은 설명 요청, 반복 혼동 개념 정리, 추천 반영 | `핵심 답변 / 짧은 이유 / 필요 시 예문 / 학습 반영` |

## 실제 운영 체인
1. 세션 시작, 시도 반영, 추천 요청은 `toeic-study-orchestrator`가 맡는다.
2. 빠른 질문과 개념 저장은 `toeic-qa-memory-desk`가 담당한다.
3. 사용자용 양식이 필요하면 `toeic-template-workbench`를 쓴다.
4. 드릴이 필요하면 `toeic-drill-generator`를 쓰되, 최종 전달 전에 `toeic-review-auditor` 기준으로 검수한다.
5. 새 자료, 새 규칙, 새 지표, 새 기술 도입은 `codex-evidence-gate`를 거친다.
6. RC 문항 분류와 taxonomy 태깅은 `toeic-rc-analysis-desk`를 쓴다.
7. RC 대량 모듈 생성은 `toeic-rc-bank-builder`를 쓴다.
8. 웹에서 받은 `sync/toeic_web_sync.json`을 반영하거나 다시 내보낼 때는 `toeic-study-orchestrator`가 전체 순서를 잡고, 필요한 경우 RC 분류와 Q&A 메모리 계층으로 라우팅한다.

## 공통 고정 규칙
- 사용자에게 보이는 설명과 안내는 한국어로 유지한다.
- 문제, 보기, 예문, 표현 묶음, collocation만 영어로 유지한다.
- TOEIC 전용 Skill은 현재 워크스페이스 전용이다.
- TOEIC 사실과 학습 설계는 이 폴더의 `AGENTS.md`와 `docs/` 문서를 기준으로 한다.
- 공식 자료를 벗어난 장문 synthetic mock test는 만들지 않는다.
- 공식 점수 추정은 하지 않는다.
- 웹 연동 파일 `sync/toeic_web_sync.json`은 RC 전용 단일 교환 파일로 취급한다.
- 웹은 원시 이벤트만 쓰고, Codex는 파생 이벤트만 쓴다.

## 자주 쓰는 호출 예시
- `이번 세션 시작` -> `toeic-study-orchestrator`
- `이 자료 풀었어, 반영해줘` -> `toeic-study-orchestrator`
- `최근 기록 기준으로 추천해줘` -> `toeic-study-orchestrator`
- `LC에서 왜 이게 답이야?` -> `toeic-qa-memory-desk`
- `Part 2 간접응답 드릴 12문항 만들어줘` -> `toeic-drill-generator` 후 `toeic-review-auditor`
- `이 기능을 도입할 가치가 있나?` -> `codex-evidence-gate`
- `이 RC 문항 유형 분류해줘` -> `toeic-rc-analysis-desk`
- `Part 5 품사 반응 50문항 뱅크 만들어줘` -> `toeic-rc-bank-builder` 후 `toeic-review-auditor`
- `웹사이트에서 받은 toeic_web_sync.json 반영해줘` -> `toeic-study-orchestrator`
- `현재 프로젝트 상태를 웹 업로드용 toeic_web_sync.json으로 내보내줘` -> `toeic-study-orchestrator`

## 2차 보류 항목
- `codex-prompt-eval-lab`은 설계만 승인된 상태다.
- 실제 구현과 활성화는 별도 승인 후에만 진행한다.
- 따라서 현재는 Prompt version, dataset eval, prompt caching 운영을 실제 워크플로에 강제하지 않는다.
