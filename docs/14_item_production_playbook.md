# 문제 제작가 운영 가이드

이 문서는 현재 TOEIC 워크스페이스에서 실제 기출을 복제하지 않고도 공식 자료에 가까운 보강 문제와 어휘 세트를 안정적으로 대량 생산하기 위한 기준 문서다.

## 목적
- 공식 앵커 기반으로 문제와 어휘를 반복 생산할 때 기준 흔들림을 줄인다.
- `기출 그대로`가 아니라 `기출과 같은 능력을 요구하는 보강 세트`를 만드는 쪽으로 생산 방향을 고정한다.
- 대량 생산 요청이 들어와도 출처 안전성, TOEIC 적합성, 검수 흐름을 유지한다.

## 공식 사실
- 공식 앵커는 한국TOEIC위원회 공개문항과 ETS 공식 Handbook, Sample Test, 준비 자료 페이지를 우선 사용한다.
- ETS 자료는 저작권 보호 대상이므로 직접 복사보다 링크, 문항 번호, 파트, 짧은 요약, 메타데이터 중심으로 다룬다.
- TOEIC Listening and Reading은 직장과 일상 상황의 일반 영어 능력을 측정하므로 생성물도 업무형 맥락을 유지해야 한다.
- 관련 공식 출처는 [docs/01_verified_sources.md](/Users/demel/OneDrive/Desktop/o/Study/English/TOEIC/docs/01_verified_sources.md)를 따른다.

## 코칭 해석
- `실제 시험과 비슷하다`는 말은 문장 복제가 아니라 `요구 능력`, `오답 유도 방식`, `직장 영어 맥락`, `패러프레이즈 거리`가 비슷하다는 뜻으로 해석한다.
- 대량 생산 효율은 한 번에 여러 파트를 섞는 방식보다 `파트 1개 + 약점 1개 + 앵커 1개` 단위 모듈형 뱅크에서 가장 잘 나온다.
- 어휘 생산도 단어 암기형보다 `표현 묶음 + 문맥 + 패러프레이즈 대응` 구조가 TOEIC 적합도가 높다.

## 작업 가정
- 기본 생산 단위는 `10-30문항` 또는 `20-40표현`의 마이크로 배치다.
- 사용자가 앵커를 지정하지 않으면 현재 프로젝트에서 승인된 공식 코퍼스를 기본 앵커로 잡는다.
- 대량 생산은 `full mock`이 아니라 `weakness bank` 누적으로 처리한다.

## 공통 생산 원칙
1. 먼저 `source_anchor`를 고정한다.
2. 그 다음 `target_part`와 `target_skill`을 하나만 고른다.
3. 생성 모드는 항상 아래 순서에서 가장 가벼운 것을 먼저 쓴다.
   - `official-extraction`
   - `transform`
   - `synthetic-lite`
4. 실제 TOEIC 문제 또는 공개문항이라고 주장하지 않는다.
5. RC 생성물 최종 출력은 기본적으로 `sync/toeic_web_sync.json`의 `materials.drill_sets[]`에 바로 들어갈 수 있는 JSON 형식으로 작성한다.
6. 최종 산출물은 반드시 `set_id`, `title`, `source_anchor`, `generation_mode`, `target_part`, `target_skill`, `difficulty`, `items`, `answer_key`, `rationale`, `review_status`, `published_at`를 포함한다.
7. `items[].question_type`은 `sync/toeic_web_sync.json`의 `lookups.question_types[target_part]` 안의 값만 쓴다.
8. `items[].skill_tag`, `items[].vocab_domain`, `items[].document_genre`도 lookup 안의 허용값만 쓴다.
9. Part 5는 RC 전용 범위이므로 앞으로 문제 출력은 JSON만 사용하고, 설명은 필요 시 JSON 바깥 짧은 한국어 문장으로만 덧붙인다.
10. 최종 전달 전 `toeic-review-auditor` 기준으로 검수한다.

## 저장과 export 흐름
1. 생성이 끝난 drill_set은 먼저 `materials/drill_sets/<part>/<set_id>.json`에 저장한다.
2. 이 개별 JSON 파일이 생성 문제의 소스 오브 트루스다.
3. 같은 계열의 후속 문항은 새 JSON 파일을 만들지 않고, 기존 drill_set 파일의 `items`, `answer_key`, `rationale` 배열에 누적 추가한다.
4. 즉, 기본 운영은 `세트 분할`보다 `기존 세트 확장`이다.
5. `review_status = pending` 세트는 저장은 가능하지만 기본 export 대상은 아니다.
6. 웹 통신용 JSON이 필요할 때만 루트 명령 `npm run sync:export-drills -- --base sync/toeic_web_sync.json --input materials/drill_sets --out <path>`를 실행한다.
7. export 유틸은 reviewed 세트만 읽어 `materials.drill_sets[]`와 `drill_set.published` 이벤트를 만든다.
8. 원본 `sync/toeic_web_sync.json`은 자동 갱신하지 않고, export 결과를 별도 출력 파일로 만든다.

## 세트 확장 규칙
- 같은 `target_part`, `target_skill`, `generation_mode`, `difficulty` 흐름이면 기존 set 파일을 우선 확장한다.
- 새 문항을 추가할 때는 기존 `set_id`를 유지한다.
- 새 문항의 `question_no`와 `item_id`는 기존 파일 안에서 충돌 없이 이어서 증가시킨다.
- 새 파일 분리는 아래처럼 기준이 바뀔 때만 허용한다.
  - `target_part` 변경
  - `target_skill` 변경
  - `generation_mode` 변경
  - 난이도 묶음 변경
  - 사용자가 명시적으로 별도 세트 분리를 지시한 경우

## 파트별 생산 레시피

### Part 2
- 우선 대상: indirect response, implied meaning, paraphrase reaction
- 가장 안전한 방식:
  - 공개문항 응답 기능 재분류
  - 응답 의도별 묶음화
  - 동일 기능의 짧은 변형 보기 생성
- 대량 생산 포인트:
  - yes/no 직답 회피
  - 제안, 일정, 위치, 원인, 책임 회피 반응
  - 표면어가 아니라 화행 기능을 기준으로 보기 배치

### Part 5
- 우선 대상: parts of speech, verb form, preposition, conjunction, collocation
- 가장 안전한 방식:
  - 빈칸 기능 재분류
  - 오답 유형별 contrast bank 생성
  - 코어 직장 어휘를 넣은 짧은 문장 변형
- 대량 생산 포인트:
  - 한 문항에 한 반응만 요구
  - 정답 근거가 문장 안에서 닫히게 유지
  - collocation 세트는 실제 업무 맥락으로 제한

### Part 6
- 우선 대상: context completion, sentence insertion, coherence cue
- 가장 안전한 방식:
  - 연결어, 지시어, referent tracking 중심의 짧은 문맥 세트
  - 공식 지문 구조를 분해한 후 기능 단위로 재조합
- 대량 생산 포인트:
  - 문단 목적이 분명해야 함
  - 삽입 문장은 앞뒤 연결 단서가 하나로 수렴해야 함

### Part 7
- 우선 대상: evidence-location, paraphrase, connect info, inference
- 가장 안전한 방식:
  - 기존 공식 문서 장르 taxonomy를 유지한 미니 지문
  - 근거 문장 위치 찾기와 패러프레이즈 대응을 분리 생성
- 대량 생산 포인트:
  - 먼저 문서 장르를 정한다
  - 그 다음 질문 기능을 정한다
  - 다중 문서형은 연결 지점 하나만 선명하게 만든다

### 어휘·표현 세트
- 우선 대상: 직장 영어 core vocab, collocation, paraphrase pair
- 가장 안전한 방식:
  - [knowledge/vocab/README.md](/Users/demel/OneDrive/Desktop/o/Study/English/TOEIC/knowledge/vocab/README.md)의 주제 세트 확장
  - 공식 맥락 기반 표현 묶음 재구성
  - 동일 문맥 내 쉬운 표현과 시험형 표현의 대응 정리
- 대량 생산 포인트:
  - 단어 단독보다 `표현 + 쓰이는 문맥 + 패러프레이즈`로 묶는다
  - Part 2, Part 5, Part 7에서 재사용 가능한 표현을 우선한다

## 대량 생산 배치 규칙
- 한 배치 안에서는 `파트`, `약점`, `generation_mode`, `difficulty`를 고정한다.
- 배치 크기가 커질수록 문항 수보다 variation grid를 먼저 설계한다.
- variation grid 기본 축:
  - 문서/상황 장르
  - 핵심 하위능력
  - 오답 유도 방식
  - 핵심 어휘 도메인
- 한 배치에서 같은 오답 패턴을 과도하게 반복하지 않는다.
- RC 대량 뱅크는 `toeic-rc-bank-builder`, LC/짧은 드릴과 공통 보강은 `toeic-drill-generator`를 우선 사용한다.

## 금지 규칙
- 보호되는 공식 문제, 지문, 스크립트, 보기, 정답 배열의 직접 복제
- 공개문항의 구조를 거의 그대로 바꿔치기한 수준의 근접 복제
- `실제 TOEIC 기출`, `공식 문제`, `출제 문제`라고 오인시키는 표현
- 200문항 full mock 자동 생성
- synthetic 결과로 점수 환산 또는 점수 보장 주장

## 생산 요청 표준 필드
- `source_anchor`
- `target_part`
- `target_skill`
- `generation_mode`
- `difficulty`
- `batch_size`
- `workplace_topic`
- `answer_key`
- `rationale`
- `review_status`

## JSON 출력 계약
- 기본 출력 단위는 아래 형태의 단일 `drill_set` 객체다.
- 여러 세트를 한 번에 줄 때도 최상위는 JSON 배열 또는 `drill_sets` 배열로 준다.
- 기본 필드 구조:

```json
{
  "set_id": "drill-p5-parts-of-speech-20260312-001",
  "title": "Part 5 Parts of Speech Reaction Set 001",
  "source_anchor": "한국TOEIC위원회 공개문항 Part 5 계열 표현 관찰 기준",
  "generation_mode": "transform",
  "target_part": "Part 5",
  "target_skill": "parts of speech",
  "difficulty": "medium",
  "items": [
    {
      "item_id": "drill-p5-pos-001-q01",
      "question_no": 1,
      "question_type": "parts of speech",
      "skill_tag": "grammar reaction",
      "vocab_domain": "general business",
      "document_genre": "memo",
      "stem": "The company plans to hire a ______ consultant for the system upgrade.",
      "choices": {
        "A": "specialize",
        "B": "specialized",
        "C": "specializes",
        "D": "specialization"
      }
    }
  ],
  "answer_key": [
    {
      "item_id": "drill-p5-pos-001-q01",
      "question_no": 1,
      "correct_answer": "B"
    }
  ],
  "rationale": [
    {
      "item_id": "drill-p5-pos-001-q01",
      "question_no": 1,
      "korean_explanation": "관사 뒤에서 명사를 수식하므로 형용사가 와야 한다."
    }
  ],
  "review_status": "reviewed",
  "published_at": "2026-03-12T23:30:00+09:00"
}
```

## Part 5 item 권장 필드
- `item_id`
- `question_no`
- `question_type`
- `skill_tag`
- `vocab_domain`
- `document_genre`
- `stem`
- `choices`

## JSON 작성 규칙
- `question_type`은 Part 5 taxonomy 값 그대로 유지한다.
- `skill_tag`는 기본적으로 `grammar reaction` 또는 `vocabulary discrimination` 중 하나를 쓴다.
- `document_genre`는 Part 5에서도 빈값 대신 가장 가까운 업무 맥락 장르를 넣는다. 예: `memo`, `notice`, `email`
- `rationale`는 배열로 유지하고 한국어 설명을 넣는다.
- `review_status`는 검수 전 `pending`, 검수 후 `reviewed`를 쓴다.
- 웹 업로드 직결 목적이 아니면 최상위 `meta/lookups/events` 전체를 매번 감싸지 않고 `drill_set` 객체만 반환해도 된다.

## 추천 라우팅
- 짧은 LC/RC 보강 드릴: `toeic-drill-generator`
- RC 대량 뱅크: `toeic-rc-bank-builder`
- 템플릿 수정: `toeic-template-workbench`
- 최종 검수: `toeic-review-auditor`
- 새 규칙 편입 또는 새 제작 방식 제안: `codex-evidence-gate`

## 실전 운용 메모
- `기출 유사도`는 문장 외형보다 능력 구조로 맞춘다.
- `대량 생산`은 양보다 배치 일관성이 중요하다.
- `어휘 세트`는 독립 암기 자료가 아니라 Part 2/5/7 재사용 자산으로 만든다.
