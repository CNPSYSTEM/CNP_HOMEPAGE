/* 사이트 설정
 * quoteEndpoint : 견적문의 폼이 보내지는 주소.
 *   - 운영 사이트: 아래 PRODUCTION_QUOTE_ENDPOINT (업무용 구글 계정의 Apps Script 웹앱) → cnp3900@naver.com 으로 메일 발송
 *   - 내 컴퓨터 미리보기(localhost): 실수로 실제 메일이 나가지 않도록 기본은 미리보기 서버(/api/quote).
 *     실제 발송을 시험할 때만 브라우저 콘솔에서  sessionStorage.setItem("cnp_realmail", "1")  을 실행한 탭에서 보냅니다.
 *   비어 있으면 폼은 "접수 완료"를 표시하지 않고 설정이 필요하다고 안내합니다.
 */
(function () {
  var PRODUCTION_QUOTE_ENDPOINT = "https://script.google.com/macros/s/AKfycbxwCSMJsW37qjHFqOoSL8EYC7XbZ7qOBt4Bx-LcCfvrXOBjAyUmrdN0zxXr-ic-wioh/exec";
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var realMailTest = false;
  try { realMailTest = sessionStorage.getItem("cnp_realmail") === "1"; } catch (_) {}
  window.CNP_CONFIG = {
    quoteEndpoint: (local && !realMailTest) ? "/api/quote" : PRODUCTION_QUOTE_ENDPOINT,
    maxFiles: 5,
    maxTotalBytes: 15 * 1024 * 1024,
    allowedExt: ["pdf", "ai", "psd", "jpg", "jpeg", "png", "zip", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx"]
  };
})();
