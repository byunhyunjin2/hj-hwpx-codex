# hj-hwpx-codex

권박사님에게 바칩니다.

Windows x64에서 **채팅에 첨부한 HWP·HWPX**를 로컬로 수정·비교하고 원래 형식으로 다운로드하는 플러그인입니다. 필요한 Node·Python·문서 엔진을 포함하므로 별도 설치가 필요하지 않습니다.

최신 배포: [**v2.2.0 hj-hwpx-codex 2.2.0**](https://github.com/byunhyunjin2/hj-hwpx-codex/releases/tag/v2.2.0)

## 사용

1. HWP/HWPX를 채팅에 첨부합니다.
2. `$hjhwpx 첨부한 문서를 수정하고 변경 전후를 보여줘`처럼 요청합니다.
3. 노란 변경 표시·빨간 확인 표시를 검토한 뒤 직접 다운로드 버튼을 누릅니다.

설치 점검은 `$hjhwpx setup`으로 실행합니다. 원본은 덮어쓰지 않으며 개인정보 보호와 원래 확장명을 유지합니다.

## 설치·업데이트

릴리즈의 `hj-hwpx-codex-2.2.0.zip`을 플러그인 화면에서 추가하거나 GitHub 마켓플레이스를 사용합니다.

최초 설치:

```powershell
codex plugin marketplace add byunhyunjin2/hj-hwpx-codex --ref main
codex plugin add hj-hwpx-codex@hj-hwpx
```

기존 설치 업데이트:

```powershell
codex plugin marketplace upgrade hj-hwpx
codex plugin remove hj-hwpx-codex@hj-hwpx
codex plugin add hj-hwpx-codex@hj-hwpx
```

업데이트 후 새 채팅에서 사용하세요.

## 2.2.0 변경

MCP Apps 지원 호스트에서는 MCP HTML로 미리보기를 표시합니다. 기존 UI·색상·비교보기·함께 스크롤·페이지 이동을 유지합니다. 미지원 호스트와 CLI에는 기존 독립 HTML 경로를 제공합니다. MCP 파일 다운로드 기능이 없으면 다운로드가 제한됩니다.

## 검증·제한

13개 회귀 그룹, 모의 MCP 호스트의 오프라인 브라우저 시험과 별도 설치 경로 검사를 수행했습니다. 실제 채팅 호스트 연동·학교 PC는 미검증이며, 미리보기 전환이 Python 실행 오류나 첨부 다운로드 차단까지 해결하지는 않습니다. 복잡한 문서 구조나 검증 불일치는 다운로드를 차단합니다. 자동 개인정보 판정은 최종 사용자 검토를 대체하지 않습니다.

임시 원본 사본은 파싱 직후, 서버의 검토 임시 파일은 세션·프로세스 종료 시 정리합니다. 호스트에 전달된 화면 데이터의 보관은 호스트 정책을 따릅니다. 임의 외부 URL·네트워크 공유의 문서는 가져오지 않습니다.

[릴리즈 노트](RELEASE_NOTES.md) · [변경 기록](CHANGELOG.md) · [검증 기록](VALIDATION.md) · [오픈소스 고지](licenses/)
