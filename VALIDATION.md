# hj-hwpx-codex 2.1.7 검증 · 2026-10-19

2.1.7 배포 검증 기록. 사용자 승인에 따라 배포하며 기존 2.1.6 태그·릴리즈 자산은 유지한다. 실행 결과는 validation.json과 함께 관리한다.

## 원인 확인

- 사용자 이미지에는 EACCES 설명만 있고 syscall·원시 진단은 없다. 과거 실행의 정확한 차단 지점은 이미지로 확정할 수 없다.
- 현재 작업 환경에서 같은 포함 Node 진단을 제한된 실행으로 수행하면 loopback EACCES, ready:false가 재현됐다.
- 도구의 정식 require_escalated 승인 경로로 동일 진단을 실행하면 loopback.available:true, ready:true였다.
- 두 실행 모두 포함 Python 3.14.8의 무결성·격리 실행·UTF-8·필수 모듈 검사를 통과했다. 재현 환경의 실패는 Python 미설치가 아닌 실행 권한 차이에 따른 로컬 포트 차단이다.

## 변경

- 진단에 listen/connect 단계와 syscall을 제공한다. 서비스 시작 실패도 preview-listen으로 구분한다.
- 정식 실행 권한 승인과 보안 우회를 구분한다. 제공되는 승인 경로에서 승인된 동일 명령만 다시 실행하며, 승인 거부 시 중단한다.
- ready는 로컬 편집·포트 준비 상태로, attachmentHelperRuntime.ready는 첨부 전달용 포함 Python 상태로 분리했다. 이미 로컬에 있는 첨부를 Python 점검 실패만으로 차단하지 않는다.
- 시스템 Python을 호출하지 않는 기존 포함 실행 경로를 유지·재검증했다. 사용자 Python 설치·환경변수·방화벽 설정은 변경하지 않았다.
- skills/setup/SKILL.md와 두 manifest의 onboardingSkill 등록을 제거했다. hjhwpx setup이 내부 references/setup.md를 읽어 같은 점검을 수행한다. setup 단독 요청에는 첨부를 요구하지 않는다.

## 통과한 검증

- 포함 Node로 scripts/verify.cjs 실행: 12개 회귀 그룹, 모든 서버·스크립트 문법, manifest, MCP 초기화·도구 조회 통과.
- EACCES listen 및 EPERM connect 주입으로 실패 단계 구분, Python 실패와 편집 준비 상태 분리, 서비스 시작 오류 분류 확인.
- 빈 PATH, 실패하는 python/py 별칭, 잘못된 PYTHONHOME/PYTHONPATH에서 포함 Python 실행. helper 호출 계약·원본 바이트·식별자·버전·완료 콜백·UTF-16 JSON·토큰 가림·덮어쓰기 방지 확인.
- scripts/verify-relocated.cjs: 임시 ZIP 제작·내용 검사 후 한글·공백을 포함한 별도 경로에 풀어 포함 Node/Python 실제 실행. 발견 가능한 스킬이 hjhwpx 하나이고 내부 setup 참조가 포함됨을 확인.
- 별도 설치 경로·빈 PATH에서 HWPX 시험 문서 수정·재검증·HTTP HTML 미리보기·원본 보존과 Library 계약 시험 통과. 시험 출력은 검사 종료 후 삭제하며 최종 배포 ZIP은 별도 보관.
- git diff --check 통과.

## 검증 한계

- Python을 제거한 별도 실물 PC 시험이 아니라 시스템 PATH·별칭·Python 환경변수를 격리한 재현 시험이다.
- 호스트 공식 Library helper 원문·실시간 완료 보고는 제공되지 않아 계약 시험 코드로 검증했다.
- 이번 채팅에는 오류 화면만 첨부됐다. 화면에 나온 실제 HWP 문서는 읽거나 수정하지 않았다. HWP 구조 회귀와 합성 HWPX 작업 흐름을 검증했다.
- 새 패키지를 호스트에 설치하지 않았으므로 실제 호출 메뉴에서의 제거·setup 자연어 라우팅·내부 브라우저 표시까지 검증했다고 주장하지 않는다. 사용자 설치 캐시는 이번 소스 배포로 직접 변경하지 않는다.
- 권한 승인이 제공되지 않거나 거부되는 호스트에서 로컬 포트를 강제로 열 수는 없다.
