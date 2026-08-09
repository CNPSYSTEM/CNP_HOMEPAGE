# C&P SYSTEM Homepage — V1 (Phase 1)

설계 기준 문서: `../CNP_HOMEPAGE_V1_BLUEPRINT.md`

## 실행 방법

정적 사이트이지만 `data/*.json`을 `fetch`로 불러오므로 브라우저 보안 정책(CORS)상
`index.html`을 더블클릭해서 여는 방식(`file://`)은 동작하지 않습니다. 아래처럼
로컬 서버로 실행하세요.

```bash
cd CNP_Homepage_V1
python3 -m http.server 8080
```

이후 브라우저에서 `http://localhost:8080` 접속.

## 현재 상태 (Phase 1)

- 구조: 헤더, 히어로, OUR VALUE, ABOUT, WORK, CAPABILITY, CLIENTS(숨김), CONTACT, 푸터 — 블루프린트 5~13절 순서 그대로 구현.
- 스타일: 기본 반응형(모바일/태블릿/데스크톱/와이드) 레이아웃, 다크·warm-white 리듬 적용. 세부 타이포/그리드/모션 다듬기는 Phase 2에서 진행.
- 데이터: `data/portfolio.json`, `data/clients.json`, `data/capability.json`로 분리 — 레이아웃 코드를 건드리지 않고 콘텐츠만 교체 가능.

## 플레이스홀더 — 실제 데이터로 교체 전까지 유지

| 항목 | 위치 | 상태 |
|---|---|---|
| 히어로/About 이미지 | `index.html` 내 `.image-placeholder` | 실제 사진 없음. CSS 패턴 placeholder만 사용 (외부 이미지 다운로드 없음) |
| 포트폴리오 프로젝트 6건 | `data/portfolio.json` | `placeholder-01`~`06`, 중립 명칭만 사용. 실제 기관/프로젝트명 아님 |
| 거래 기관(Clients) | `data/clients.json` | 빈 배열. 검증 전까지 CLIENTS 섹션 및 네비 항목 자동 숨김 |
| Capability 항목 | `data/capability.json` | 디자인·인쇄·제본·후가공·대형출력만 노출(`verified: true`). 견적서 발행/세금계산서 발행/카드결제는 사실 확인 전까지 `verified: false`로 비노출 |
| 이메일/전화/주소/사업자등록번호 | `index.html` footer, contact 섹션 | `[VERIFY: ...]` 로 표기, 확인 전까지 임의 값 금지 |
| 카카오톡 채널 링크 | `index.html` contact 섹션 | `[VERIFY: 카카오톡 채널 링크 필요]` |

## 폰트

번들 폰트 파일 없음. 현재는 시스템 폰트 스택(`--font-sans`, `css/styles.css`)만 사용합니다.
합법적으로 사용 가능한 한글 웹폰트(예: Pretendard, OFL 라이선스)를 채택하기로 결정하면
`index.html` 상단 주석의 CDN 링크를 해제하고 `--font-sans` 값만 교체하면 됩니다 — 폰트 파일을
저장소에 저장할 필요가 없습니다.

## 다음 (Phase 2)

타이포그래피/그리드/스페이싱 디테일, 다크·라이트 리듬 다듬기, 호버 상태, 절제된 모션 보강.
