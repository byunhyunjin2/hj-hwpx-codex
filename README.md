# hj-hwpx-codex 1.0.6

HWP/HWPX 비교·검토·다운로드 플러그인입니다.

## GitHub에서 설치하기

Private 저장소이므로 설치 전에 저장소 소유자에게 GitHub 협력자로 초대받고 초대를 수락해야 합니다. Git 인증이 설정된 뒤 Codex CLI에서 아래 명령으로 마켓플레이스를 등록하고 갱신합니다.

```powershell
codex plugin marketplace add byunhyunjin2/hj-hwpx-codex --sparse .agents/plugins
codex plugin marketplace upgrade hj-hwpx
```

그 다음 Codex 데스크톱의 플러그인 디렉터리에서 `hj-hwpx-codex`를 설치하고, 새 대화에서 `hj-hwpx 버전 확인해줘`라고 요청해 실행 버전을 확인하세요. 개인 계정 소유의 Private 저장소에서 협력자는 저장소 내용을 읽고 쓸 수 있습니다.

## 처음 설치

1. ChatGPT 데스크톱 앱에서 플러그인 > 플러그인 압축파일 업로드를 선택합니다.
2. hj-hwpx-codex-1.0.6.zip을 그대로 업로드하고 플러그인 추가를 누릅니다.
3. 활성화한 뒤 새 대화에서 hj-hwpx-codex를 선택합니다.
4. HWP/HWPX 문서를 첨부하고 “이 문서를 비교 미리보기로 열어줘”라고 요청합니다.

압축 해제, 실행파일 실행, 터미널 명령, 추가 프로그램 설치, 수동 서버 시작은 필요하지 않습니다. 필요한 실행 구성은 ZIP에 포함됩니다. Windows x64와 로컬 실행을 지원하는 대화가 필요합니다. 웹·모바일 채팅에서의 실행은 보장하지 않습니다.

## 버전 확인과 업데이트

설치나 업데이트를 마친 뒤 새 대화에서 "hj-hwpx 버전 확인해줘"라고 요청하세요. 플러그인의 `hjhwpx_version` 도구가 실제로 실행 중인 버전을 알려 줍니다.

**ChatGPT 데스크톱**
1. 플러그인 > 플러그인 압축파일 업로드에서 새 ZIP을 올립니다.
2. 기존 항목이 교체되지 않고 중복되면 관리 화면에서 구버전만 삭제한 뒤 다시 올립니다.
3. 새 대화에서 버전을 확인합니다.

**Codex**
1. 새 ZIP을 받은 뒤 PowerShell에서 아래 명령을 실행합니다.
   `powershell -ExecutionPolicy Bypass -File <압축 푼 폴더>\hj-hwpx-codex\scripts\update-codex.ps1 -Zip <새 ZIP 경로>`
2. 스크립트가 ZIP을 풀고 로컬 마켓플레이스 `hj-hwpx`(`%LOCALAPPDATA%\hj-hwpx-marketplace`)에 등록한 뒤 `codex plugin add`로 설치하고, 설치된 버전까지 검사합니다. 이전 버전 폴더는 휴지통으로 이동합니다.
3. Codex에서 새 대화를 열고 버전을 확인합니다.

ZIP 업로드로 설치한 이전 버전(예: 1.0.4)이 Codex에도 남아 있으면 도구 이름이 겹칩니다. 플러그인 관리 화면에서 이전 항목을 삭제하세요.

**새 버전을 만들 때:** `plugin.json`과 `.codex-plugin/plugin.json`의 `version`을 함께 올리세요. Codex는 루트 `plugin.json`의 버전을 사용합니다. 두 버전이 다르면 업데이트 스크립트가 중단됩니다.

## 기능과 범위

원본 배치 미리보기, 변경 전후 비교, 함께 스크롤, 페이지 선택, 주석 달기, 노란색 변경 표시, 빨간색 확인 표시, 개인정보·식별번호 보호를 제공합니다. 다운로드 버튼을 클릭하면 검증 후 원래 HWP/HWPX 형식으로 저장됩니다.

원본은 덮어쓰지 않습니다. 주석과 검토 색상은 미리보기 전용입니다. 복잡한 필드·개체·표·암호·DRM 문서 등은 일부 미지원이며, 검증이 맞지 않으면 다운로드를 중단합니다. 미리보기와 저장본의 줄바꿈·쪽나눔이 달라질 수 있습니다.

문서는 로컬에서 처리됩니다. 사용자 문서나 API 키는 ZIP에 포함하지 않았습니다. 오픈소스 고지는 licenses/에 있습니다. ZIP을 다른 사람에게 전달하면 각자 업로드할 수 있습니다.
