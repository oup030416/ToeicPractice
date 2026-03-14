# TOEIC WEB v1

`WEB/` 폴더는 TOEIC 학습 워크스페이스의 RC 웹 대시보드와 문제 풀이 프런트엔드다. 웹 관련 파일은 이 폴더 안에서만 관리한다.

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

## Google Drive 환경 변수
`.env.local` 또는 배포 환경에 아래 값을 넣어야 한다.

```bash
VITE_GOOGLE_CLIENT_ID=your-web-oauth-client-id
VITE_GOOGLE_API_KEY=your-browser-api-key
VITE_GOOGLE_APP_ID=your-google-cloud-project-number
```

예시는 [`.env.example`](C:/Users/demel/OneDrive/Desktop/o/Study/English/TOEIC/WEB/.env.example)에 있다.

## Google Cloud 설정 체크리스트
1. Google Cloud에서 OAuth consent screen을 만든다.
2. Web OAuth Client를 만든다.
3. Google Drive API와 Google Picker API를 활성화한다.
4. Authorized JavaScript origins에 아래 주소를 넣는다.
   - `http://localhost:5173`
   - `https://oup030416.github.io`
5. 개인용 운영이라면 OAuth testing mode와 본인 계정 test user 등록으로 시작한다.

## 현재 동작 원칙
- 메인 저장소는 Google Drive 폴더 안의 `toeic_web_sync.json` 단일 파일이다.
- 편집, 메모, RC 문제 풀이 기록은 1초 debounce 후 Drive live 파일에 자동 저장된다.
- 같은 폴더 아래 `backups/` 폴더를 만들고, 마지막 백업 후 30분 이상 지났을 때만 백업 파일을 추가한다.
- localStorage에는 문서 본문이 아니라 Drive 연결 정보만 저장한다.
- 수동 JSON 가져오기/내보내기는 비상 복구 패널에서만 제공한다.

## 모바일 사용 주의
- 같은 기기 안에서는 브라우저 새로고침 후 Drive 재연결로 이어서 쓸 수 있다.
- 다른 기기에서도 같은 Google 계정과 같은 Drive 폴더를 쓰면 같은 live 파일을 불러온다.
- 진행 중이던 미저장 임시 상태는 새로고침 복원 대상이 아니다. 확정된 편집만 Drive에 반영된다.
