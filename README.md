# 씨앤피시스템 홈페이지 — 리뉴얼 v1 (2026-11-18)

사진 중심 · 여백 · 간결한 메뉴. 서버 없이 GitHub Pages(cnpsystem.kr)에서 그대로 돌아가는 정적 사이트입니다.

## 미리보기 켜기 (내 컴퓨터)

```bash
python _tools/preview_server.py
```

- 사이트: http://localhost:8790/
- 관리자: http://localhost:8790/admin/ — 비밀번호는 `_tools/.preview_password` 파일에 있습니다.

## 주소

| 메뉴 | 주소 |
|---|---|
| 대문 + 포트폴리오 목록 | `/` |
| 회사소개 | `/about/` |
| 포트폴리오 | `/portfolio/` |
| 작품 상세 | `/portfolio/작품주소/` |
| 견적문의 | `/contact/` (작품에서 들어오면 `?work=작품주소`) |
| 안내 | `/guide/` |
| 관리자 | `/admin/` (검색 제외) |

## 관리자에서 사진 한 장 바꾸기

- **대문 사진**: 관리자 → `대문 사진` → `사진 바꾸기` → PC·모바일 미리보기에서 사진을 끌어 초점 맞춤 → `글자 뒤 어둡게`로 문구 가독성 확인 → `저장하고 사이트에 반영`
- **작품 사진**: 관리자 → `포트폴리오` → 작품 사진 누르기 → 사진 올리기/삭제/순서/대표 선택 → `저장`

## 폴더 구조

| 위치 | 내용 |
|---|---|
| `index.html`, `about/`, `portfolio/`, `contact/`, `guide/`, `404.html` | 공개 페이지 |
| `portfolio/작품주소/index.html` | 작품 상세 (관리자가 자동으로 만들고 지움) |
| `media/` | 공개 중인 사진 (대문, 작품) |
| `data/site.json`, `sitemap.xml` | 공개 작품 목록, 사이트맵 (관리자가 자동 갱신) |
| `_private/` | 전체 내용(`content.json`)과 임시저장·비공개 작품 사진. 저장소에는 함께 올라가지만 사이트 주소로는 열리지 않음 |
| `_templates/work.html` | 작품 상세 틀 |
| `_tools/` | 미리보기 서버, 가짜 GitHub 시험 서버, 페이지 틀 도구, 메일 발송 스크립트, `설정_안내.md` |
| `admin/` | 관리자 화면 |

`_` 로 시작하는 폴더는 GitHub Pages 가 사이트로 내보내지 않습니다(그래서 `.nojekyll` 파일을 만들면 안 됩니다).

## 관리자 시험 (운영·실제 GitHub 와 분리)

```bash
python _tools/test_github_server.py
```

http://localhost:8792/admin/ (열쇠 `test-token-1`). 임시 폴더에 진짜 git 저장소를 만들어 운영과 같은 저장 방식으로 시험합니다. 이 폴더 파일은 바꾸지 않습니다.

## 회사소개 · 안내 문구 쓰기

`about/index.html`, `guide/index.html` 안의 `▼ … 본문` 표시 사이를 고치면 됩니다.
메뉴·바닥글을 바꿀 때는 `_tools/scaffold.py` 를 고친 뒤 `python _tools/scaffold.py` 를 실행합니다(작품 목록·대문 부분은 보존).

## 운영 설정

`_tools/설정_안내.md` 에 대표님이 직접 하실 단계만 정리했습니다.

- 관리자 열쇠(토큰): 저장소 `CNP_HOMEPAGE` 하나에 Contents: Read and write (보관함 저장소는 쓰지 않음)
- 견적 메일: 업무용 구글 계정의 Apps Script 웹 앱 — 주소는 `js/config.js` 의 `PRODUCTION_QUOTE_ENDPOINT`
- 배포 제외: `media/hero/hero-mwm8fvdo.jpg`(시험 사진), 미리보기 비밀번호·시험 메일 파일 (.gitignore)

## 이전 버전(v1) 복구

- 저장소 태그 `v1-backup-20261118` (커밋 2ca7e8d)
- 보관 파일 `클로드\CNP_HOMEPAGE_v1_보관_20261118.zip`
