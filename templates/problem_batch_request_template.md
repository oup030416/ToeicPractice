# 문제 배치 요청 템플릿

- 용도: 보강 문제 또는 어휘 세트 대량 생성 요청
- 대상 파트: Part 2 / Part 5 / Part 6 / Part 7 / 어휘
- 입력 자료: 공식 앵커, 최근 약점, 원하는 생산 규모
- 재사용 가능 여부: 가능

## 요청 메타
- 요청 이름:
- source_anchor:
- target_part:
- target_skill:
- generation_mode: official-extraction / transform / synthetic-lite
- batch_size:
- difficulty:
- workplace_topic:
- output_format: drill_set_json

## 세부 조건
- 반드시 넣을 요소:
- 피할 요소:
- 오답 유도 방식:
- 필요한 출력 형식: mini-drill / bank / vocab set
- answer_key 포함 여부: yes / no
- rationale 포함 여부: yes / no

## 검수 조건
- 공식 문제처럼 보이지 않게 유지:
- 직장 영어 맥락 유지:
- 한국어 안내 유지:
- review_status: pending

## 요청 한 줄 예시
- `한국TOEIC위원회 공개문항 Part 5 앵커 기준으로 parts of speech 반응형 20문항 뱅크 만들어줘. output_format은 drill_set_json, generation_mode는 transform, difficulty는 medium, topic은 office communication으로 맞춰줘.`

## JSON 요청 예시
```json
{
  "request_name": "part5-parts-of-speech-batch-001",
  "source_anchor": "한국TOEIC위원회 공개문항 Part 5 계열 표현 관찰 기준",
  "target_part": "Part 5",
  "target_skill": "parts of speech",
  "generation_mode": "transform",
  "batch_size": 10,
  "difficulty": "medium",
  "workplace_topic": "general business",
  "output_format": "drill_set_json",
  "must_include": [
    "clear adjective vs adverb vs noun contrasts"
  ],
  "avoid": [
    "official sentence copying",
    "double-answer ambiguity"
  ],
  "distractor_pattern": "mixed form confusion",
  "include_answer_key": true,
  "include_rationale": true,
  "review_status": "pending"
}
```
