# TOEIC WEB v1

`WEB/` 폴더는 TOEIC 학습 워크스페이스의 RC 웹 대시보드 전용 프런트엔드다. 웹 관련 파일은 이 폴더 안에서만 관리한다.

## 기술 스택
- Vite 7
- React 19
- TypeScript
- Tailwind CSS v4
- Zod
- Vitest + Testing Library

## 개발 명령어
```bash
npm install
npm run dev
npm run test
npm run build
```

## 현재 범위
- `sync/toeic_web_sync.json` 업로드
- 현재 로드된 JSON 다운로드
- 메타, 추천, 약점, 대시보드, 이벤트, taxonomy 시각화
- RC 문제 풀기 버튼 placeholder

실제 RC 문제 풀이 UI와 JSON 편집 기능은 아직 구현하지 않는다.

## 데이터 원칙
- 업로드한 JSON은 검증 후 메모리와 localStorage에 보관한다.
- 외부 포맷은 수정하지 않고 그대로 다시 다운로드한다.
- 정의되지 않은 미래 이벤트도 버리지 않고 generic detail 뷰로 노출한다.
