# hj-hwpx-codex 2.1.10 검증 · 2026-10-20

2.1.9를 기준으로 한 MCP HTML 전환이다. 사용자의 배포 승인에 따라 2.1.10으로 배포한다. 설치 캐시는 직접 변경하지 않으며 기존 태그와 릴리즈 자산을 유지한다.

## 변경 범위

- MCP Apps 지원을 초기화 capability(`io.modelcontextprotocol/ui`)로 확인하고 열기·갱신 도구에 `ui://hjhwpx/review-v1.html`을 연결한다.
- `resources/list`와 `resources/read`로 `text/html;profile=mcp-app` HTML 템플릿을 제공한다. 템플릿 자체에는 사용자 문서가 없다.
- 기존 HTML 생성기와 검증된 snapshot을 그대로 재사용한다. 문서·이미지·다운로드 바이트는 도구 결과의 UI 전용 `_meta.review`에 넣고 일반 텍스트 결과에는 요약만 제공한다.
- MCP HTML에서는 file URL이나 로컬 웹서버를 열지 않는다. 외부 스크립트·스타일·이미지·통신 도메인과 중첩 iframe도 요구하지 않는다.
- 기존 iframe 패널은 MCP 화면에서만 Shadow DOM 기반 스크롤 패널로 바꾼다. 공통 CSS·버튼·비교보기 초기값(단일보기)·함께 스크롤 초기값(켜짐)·쪽 선택·노란 변경 표시·빨간 확인 표시·변환 진행 표시를 보존한다.
- 다운로드는 실제 사용자 버튼 입력 후 호스트의 `ui/download-file`에 검증된 원래 형식 바이트를 전달한다. 프로그램으로 만든 버튼 클릭은 내보내지 않는다. 기능 미지원 시 버튼을 비활성화하고, 거부·취소·시간 초과는 미완료로 표시한다.
- 오래된 revision과 다른 세션의 알림을 무시하고, 갱신 표시를 순서대로 처리한다. 화면 종료 시 패널과 다운로드 핸들러를 정리한다.
- MCP Apps 미지원 호스트와 CLI에는 기존 독립 HTML 경로를 유지한다. 원복은 이번 변경을 되돌리면 되며 원본 문서나 저장 형식의 데이터 이전은 없다.
- 첨부 입력·Python helper·문서 수정 엔진·개인정보 보호 규칙은 이번 변경 대상이 아니다.

## 실행한 검사

1. `runtime/win32-x64/node.exe scripts/verify.cjs`: 13개 회귀 그룹, 서버·스크립트 문법, manifest, MCP 초기화와 도구 조회 통과.
2. `server/ui-preservation.test.cjs`: MCP와 기존 파일 미리보기의 공통 CSS가 문자열 단위로 동일한지 검사. 공통 컨트롤과 페이지 위치 로직, 스크립트 문법, MCP 화면의 frame/connect 차단 확인.
3. `server/mcp-view.test.cjs`: 실제 stdio MCP 프로세스에서 capability 협상·도구 메타데이터·리소스 조회·HWPX 수정과 갱신·UI 전용 payload·원본 보존·잘못된 리소스 거부·오래된 revision 거부·미지원 호스트의 기존 HTML 대체 경로 확인.
4. `server/mcp-view.browser.test.cjs`: 오프라인 Edge headless의 sandbox iframe에서 모의 MCP 호스트와 연결. 비교보기·쪽 선택·함께 스크롤·표시 색상·기본값·페이지 위치 보존·revision 갱신·다운로드 요청 바이트/형식·취소·미지원·종료를 검사. 375/768/1440px 폭에서 컨트롤 표시 확인.
5. 같은 브라우저에서 실제 HWPX 파서·검증기가 만든 합성 첨부의 변경 전/후와 변경 강조 표시를 확인. 기존 파일 미리보기의 snapshot과 MCP payload가 완전히 일치하며 원본 바이트가 보존되는지 검사.
6. `scripts/verify-relocated.cjs`: 시험용 ZIP을 별도 한글·공백 경로에 풀어 포함 Node/Python·빈 PATH와 HWPX 흐름·Library 호출 계약·새 MCP 리소스 통합 검사를 실행. 임시 ZIP·추출 경로·합성 문서 출력은 검사 종료 후 삭제한다.

브라우저 시험의 다운로드 버튼은 합성 데이터에 대해 모의 호스트 요청만 검증하며 파일을 실제 저장하지 않는다. 시험 화면은 사용자 문서가 아닌 합성 3쪽 문서다. 브라우저 자동화 의존성은 작성 환경에서만 사용하고 플러그인 실행에 추가하지 않는다.

## 아직 확인하지 않은 범위

- 현재 설치된 ChatGPT/Codex 플러그인을 바꾸지 않았으므로 실제 호스트의 MCP HTML 표시·다운로드 capability는 미검증이다. 도구 프로토콜 시험과 모의 호스트 브라우저 시험을 실제 채팅 연동 성공으로 표현하지 않는다.
- 학교 PC의 방화벽·보안 제품·자식 프로세스 실행·첨부 다운로드 주소 접근은 시험하지 않았다. 미리보기 전달 변경이 `LIBRARY_RUNTIME_START_FAILED` 또는 첨부 다운로드 차단을 해결한다고 주장하지 않는다.
- 실제 사용자 HWP 문서가 이번 요청에 첨부되지 않아 합성 HWPX와 기존 HWP 구조 회귀로 검증했다.
- 호스트가 MCP Apps 또는 `ui/download-file`을 지원하지 않으면 각각 기존 HTML 호환 경로 또는 다운로드 미지원 안내를 제공한다.

## 참고 규격

- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/reference
- https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/draft/apps.mdx
- https://github.com/openai/mcp-extensions/blob/main/docs/spec.md
