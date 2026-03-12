# Skill 운영의 공식 근거

검증 기준일: 2026-03-12 (Asia/Seoul)

이 문서는 TOEIC 시험 사실이 아니라, Codex Skill 운영 방식과 AI 프롬프트·평가·캐시 개념을 어떤 공식 자료에 근거해 설계했는지 정리한 문서다.

## OpenAI 공식 근거

| 주제 | 공식 출처 | 확인 내용 | 현재 프로젝트 적용 |
| --- | --- | --- | --- |
| Codex와 AGENTS | [Introducing Codex](https://openai.com/index/introducing-codex/) | OpenAI는 Codex가 `AGENTS.md`를 통해 프로젝트 표준, 테스트 명령, 코드베이스 탐색 방법을 학습한다고 설명한다. 또한 사용자가 로그와 테스트 결과를 통해 작업을 검증해야 한다고 말한다. | 워크스페이스 규칙과 증거 우선 원칙을 고정함 |
| Skill 개념 | [Introducing the Codex app](https://openai.com/index/introducing-the-codex-app/) | OpenAI는 Skills가 instructions, resources, scripts를 묶어 신뢰성 있게 워크플로를 수행하게 한다고 설명한다. 또한 내부적으로 수백 개의 Skill을 사용한다고 밝힌다. | 이번 프로젝트에서 역할별 Skill 분리 구조를 채택함 |
| 프롬프트 버전·변수 | [OpenAI Prompting Guide](https://developers.openai.com/api/docs/guides/prompting) | OpenAI는 long-lived prompt object, versioning, templating, `{{variable}}`, linked eval 재실행을 권장한다. | 2차 확장인 `codex-prompt-eval-lab` 설계 근거로만 보관 |
| 평가 설계 | [Evaluation Best Practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices) | success criteria 정의, 데이터셋 수집, 평가 지표, 비교, 연속 평가를 제시하고 자동 평가와 인간 판단을 함께 쓰라고 한다. | `toeic-review-auditor`의 검수 루브릭과 2차 eval 설계 기준으로 반영 |
| Prompt optimizer | [Prompt optimizer](https://developers.openai.com/api/docs/guides/prompt-optimizer) | dataset과 grader 품질이 중요하며, 최적화된 프롬프트도 실제 운영 전 수동 검토가 필요하다고 설명한다. | 2차 레이어를 별도 승인 후로 미룬 이유 |
| Prompt caching | [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) | 정적 내용은 앞, 가변 내용은 뒤에 두어 exact prefix 기반 캐시 적중을 높이라고 설명한다. | 현재는 참고만 하고, 2차 확장 시에만 실제 적용 예정 |

## Anthropic 공식 근거

| 주제 | 공식 출처 | 확인 내용 | 현재 프로젝트 적용 |
| --- | --- | --- | --- |
| 역할 분리형 에이전트 | [Subagents](https://code.claude.com/docs/en/sub-agents) | Anthropic은 description 기반 위임, 별도 context window, 도구 제한, 독립 권한을 서브에이전트의 핵심으로 설명한다. | 역할이 겹치지 않도록 Skill을 5개로 분리함 |
| 프롬프트 엔지니어링 전제 | [Prompt engineering overview](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview) | 성공 기준과 경험적 테스트가 먼저 정의되어 있어야 한다고 명시한다. | 추천 시스템도 기록 기준과 검수 기준을 먼저 고정한 뒤 운영하도록 설계함 |
| Prompt caching | [Prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) | `tools -> system -> messages` 순서의 전체 prefix를 캐시하며, 정적 내용은 앞에 두라고 설명한다. 기본 수명은 5분, 확장 시 1시간이다. | 현재는 참고만 보관하고, 2차에서만 적용 검토 |

## 현재 적용 결정
- 즉시 적용:
  - Skill 역할 분리
  - 승인 게이트
  - 검수 게이트
  - 사용자 노출 언어 정책
  - 프로젝트 문서 우선 운영
  - 기록 기반 추천 구조
- 보류:
  - Prompt version 실운영
  - Dataset/Evals 연동
  - Prompt caching 실사용
  - API 의존형 자동화

## 왜 이렇게 적용했는가
- 현재 프로젝트는 TOEIC 적응형 학습 워크스페이스이므로, 먼저 필요한 것은 대량 생성보다 운영 안정성, 품질 통제, 기록 일관성이다.
- 따라서 OpenAI·Anthropic 공식 자료에서 공통으로 강조하는 역할 분리, 명확한 설명, 평가, 검수, 정적 규칙 우선 원칙만 1차에 반영했다.
- 나머지 프롬프트 버전 관리, eval 자동화, cache 최적화는 가치가 있지만 지금 단계에서는 과도한 복잡도를 만든다고 판단해 2차로 미뤘다.
