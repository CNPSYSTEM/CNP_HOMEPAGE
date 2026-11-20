/* 관리자 화면 설정
 * 운영(cnpsystem.kr/admin/) : GitHub 저장소에 저장합니다.
 *   repo        = 사이트 저장소 — GitHub Pages 로 나가는 파일 + 전체 내용(_private/content.json)
 *   privateRepo = (선택) 비공개 보관함 저장소. 비어 있으면 쓰지 않습니다.
 *   ※ 보관함 없이 쓰면 임시저장·비공개 작품 사진도 이 저장소의 _private 폴더에 들어갑니다.
 *     사이트 주소로는 열리지 않지만 저장소 자체는 공개라서, 공개해도 되는 사진만 올려야 합니다.
 * 내 컴퓨터 미리보기(localhost) : 미리보기 서버가 이 폴더 파일에 저장합니다(_private 폴더 = 보관함).
 */
window.CNP_ADMIN = {
  repo: "CNPSYSTEM/CNP_HOMEPAGE",
  branch: "main",
  privateRepo: "",   // 비워 두면 보관함 없이 위 저장소 하나만 씁니다(2026-11-21 대표 결정). 따로 두려면 "소유자/저장소이름"
  privateBranch: "main",
  siteUrl: "https://cnpsystem.kr"
};
