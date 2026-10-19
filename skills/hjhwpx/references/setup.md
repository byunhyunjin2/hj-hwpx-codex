# 새 설치 점검

이 문서는 hjhwpx의 setup 하위 작업이다. 플러그인 루트는 상위 skills/hjhwpx/SKILL.md에서 두 단계 위다. 임의의 PC 경로나 버전을 고정하지 않는다.

1. 첨부를 읽기 전에 `hjhwpx_check_environment({})`를 실제 호출하고 응답의 `ready`를 확인한다. 목록에 도구가 있는지만 보고 성공으로 처리하지 않는다. 도구가 없거나 호출 실패 시 플러그인에 포함된 `runtime/win32-x64/node.exe`로 `scripts/check-environment.cjs`를 실제 실행해 응답을 확인한다. 환경 연결이 정상이면 호스트가 제공한 첨부 경로로 작업을 계속한다. 현재 요청에서 이미 성공한 진단은 반복하지 않는다. 추가 첨부 경로 점검은 존재·읽기 권한만 확인하며 원본 본문은 읽지 않는다.
2. 서버의 `ready`는 실행기·패키지·로컬 포트 상태만 뜻한다. 채팅에 도구가 실제로 노출되는지는 별도로 확인한다. 도구가 없지만 점검이 정상이면 재설치부터 요구하지 않고 `skills/hjhwpx/SKILL.md`의 로컬 실행 대체 경로로 현재 작업을 계속한다.
3. 이 플러그인은 채팅에 첨부한 HWP·HWPX만 로컬에서 편집한다. 식별자만 있으면 현재 대화의 첨부 메타데이터를 조회하고 호스트의 공식 첨부 로컬 전달 기능으로 **동일 첨부**를 편집기에 준비한다. 제공된 `library.prepare_materialize`도 이 용도에는 허용된다. 임의 외부 URL 다운로드·다른 원본 가져오기와 구분한다. `ATTACHMENT_STAGING_REQUIRED`이면 같은 식별자로 내부 전달을 계속한다. 첨부 누락으로 단정하거나 재첨부·새 채팅·원본 위치 질문을 반복하지 않는다. 도구 연결, 첨부 전달, 파일 접근, 미리보기 준비, 탭 열기를 구분하며 `ready:true`만으로 첨부 성공을 주장하지 않는다. 폴더·네트워크 공유 탐색과 보안 정책 우회는 하지 않는다.
4. 진단 결과는 현재 점검 결과라고 안내한다. 다른 PC 또는 호스트의 도구 등록·설치 성공까지 보증하지 않는다. 사용자가 문서 편집도 요청했다면 진단 설명만 하고 끝내지 말고 hjhwpx 작업을 이어간다. 설치·계정 설정은 변경하지 않는다.

5. 이미 설치된 PC에서 다른 결과가 나오면 재설치를 반복하지 않는다. 진단의 version·identity.skillSha256·identity.installedFilesSha256으로 실제 실행 서버의 패키지를 대조한다. 이 값은 서버 쪽 파일을 식별하며 호스트가 어떤 스킬을 선택했는지까지 증명하지 않는다. 첨부 전달 금지 안내가 계속 나오면 현재 읽은 스킬의 지침과 진단의 attachmentPolicy를 비교해 불일치를 밝힌다.

6. 진단 중에도 HWP/HWPX 원본 첨부를 파일 뷰어로 열지 않는다. 문서 표시가 필요하면 hjhwpx가 생성한 HTML 검토 화면만 사용한다.

7. `attachmentHelperRuntime.ready`가 실제 포함 Python의 실행·SSL/HTTP 모듈·파일 무결성 검사 결과인지 확인한다. `systemPythonUsed:false`, `separateInstallRequired:false`를 유지한다. 일반 `python`/`py`로 공식 helper를 실행하거나 설치를 요구하지 않는다. 첨부 전달에는 포함 Node로 `scripts/library-transfer.cjs --helper <공식helper> --transfer-json <전달응답JSON> --output <원본확장명경로>`를 사용한다. `ready:true`는 공식 helper 소스 제공이나 호스트의 실제 완료 보고 성공까지 뜻하지 않는다.

8. 로컬 포트 EACCES/EPERM은 Python 미설치와 구분한다. loopback.stage(listen/connect)와 code를 보고, 실행 도구가 정식 권한 승인 기능을 제공하면 같은 포함 실행기 진단에 대해 승인을 요청한다. 승인된 경우만 재실행한다. 거부되거나 승인 후에도 실패하면 중단하고 실제 제한을 보고한다. 보안 설정·방화벽·포트 순회·외부 중계로 우회하지 않는다.

9. ready는 로컬 편집·포트 준비 상태다. attachmentHelperRuntime.ready는 별도로 확인한다. 이미 로컬에 준비된 첨부는 Python이 필요 없으며, 공식 Library helper가 필요한 경우에만 포함 Python의 정상 상태가 필수다. 포함 Python 실패를 시스템 Python 설치로 해결하지 않는다.
