# HWP 미리보기 수정 소스

기반은 kordoc 4.22.11(MIT)입니다. 공식 패키지 소스맵의 원본 중 수정한 네 파일을 보관합니다. 런타임은 lib/preview-renderer.cjs 자체 포함 번들을 사용합니다.

셀 내부의 떠 있는 표는 저장된 호스트 줄과 직전 문단 위치를 비교해 기준점을 판별합니다. 표 그리기, 콘텐츠 높이 측정, 쪽 분할에 같은 기준점을 적용하고 실제로 밀린 줄에는 기존 역산을 유지합니다.

그림 레코드는 실제 dimwidth/dimheight와 절대 left/top/right/bottom 경계를 사용합니다. 구버전 레코드는 원본 크기로 폴백하고 의도적인 자르기를 유지합니다. 변경은 미리보기 메모리 DOM에 적용됩니다.

개발 시 kordoc@4.22.11 및 esbuild@0.28.1을 설치한 뒤 node scripts/build-preview-renderer.cjs로 재빌드합니다. 추출한 전체 소스는 무시되는 .renderer-build에 생성됩니다. node scripts/verify.cjs로 UI 보존, 표 기준점, 그림 경계와 서버 검사를 실행합니다.
