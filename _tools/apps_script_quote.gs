/**
 * 씨앤피시스템 홈페이지 — 견적문의 메일 발송 (구글 Apps Script 웹앱)
 *
 * 홈페이지(GitHub Pages)는 서버가 없어 스스로 메일을 보낼 수 없습니다.
 * 이 스크립트를 구글 계정에 무료로 올려 두면, 폼이 보낸 내용을 cnp3900@naver.com 으로 메일 발송합니다.
 * (보내는 사람 = 이 스크립트를 올린 씨앤피 업무용 구글 계정 / 받는 곳 = cnp3900@naver.com / 답장 = 고객 이메일)
 * 고객 정보와 첨부는 메일로만 전달되며 홈페이지 저장소(GitHub)에는 저장되지 않습니다.
 *
 * 설치 (약 5분, 무료):
 *  1) https://script.google.com → 새 프로젝트 → 이 파일 내용을 전부 붙여 넣고 저장
 *  2) 배포 → 새 배포 → 유형: 웹 앱 → 실행: 나 / 액세스 권한: 모든 사용자 → 배포 → 권한 허용
 *  3) 나온 웹 앱 주소(https://script.google.com/macros/s/…/exec)를
 *     홈페이지 js/config.js 의 PRODUCTION_QUOTE_ENDPOINT 에 넣기
 * 한도: 일반 구글 계정은 하루 100통, 첨부 합계 15MB(폼에서 제한).
 */
var QUOTE_TO = 'cnp3900@naver.com';
var SITE = 'https://cnpsystem.kr';
var MAX_FILES = 5, MAX_TOTAL = 15 * 1024 * 1024;
var ALLOWED = ['pdf','ai','psd','jpg','jpeg','png','zip','hwp','hwpx','doc','docx','xls','xlsx','ppt','pptx'];

function clean_(v, n) { return String(v || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, n); }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    if (d.website) return out_({ ok: false, message: '전송하지 못했습니다.' });
    var name = clean_(d.name, 40), phone = clean_(d.phone, 30), email = clean_(d.email, 100);
    var item = clean_(d.item, 60), qty = clean_(d.qty, 40), org = clean_(d.org, 60), due = clean_(d.due, 20);
    var notes = String(d.notes || '').trim().slice(0, 3000);
    if (!name || !phone || !email || !item || !qty) return out_({ ok: false, message: '필수 항목이 비어 있습니다.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out_({ ok: false, message: '이메일 주소 형식을 확인해 주세요.' });
    var slug = clean_(d.workSlug, 60), workTitle = clean_(d.workTitle, 100);
    if (slug && !/^[a-z0-9-]+$/.test(slug)) slug = '';

    var files = d.files || [], blobs = [], total = 0;
    if (files.length > MAX_FILES) return out_({ ok: false, message: '파일은 최대 5개까지 첨부할 수 있습니다.' });
    for (var i = 0; i < files.length; i++) {
      var fname = clean_(files[i].name, 120).replace(/^.*[\\/]/, '') || 'file';
      var ext = fname.indexOf('.') > -1 ? fname.split('.').pop().toLowerCase() : '';
      if (ALLOWED.indexOf(ext) < 0) return out_({ ok: false, message: '첨부할 수 없는 형식입니다: ' + fname });
      var bytes = Utilities.base64Decode(files[i].b64 || '');
      total += bytes.length;
      blobs.push(Utilities.newBlob(bytes, files[i].type || 'application/octet-stream', fname));
    }
    if (total > MAX_TOTAL) return out_({ ok: false, message: '첨부 파일 합계가 15MB를 넘습니다.' });

    var subject = '[홈페이지 견적] ' + item + ' · ' + qty + ' · ' + (org || name);
    var lines = ['홈페이지 견적문의가 접수되었습니다.', '',
      '■ 담당자명: ' + name, '■ 연락처: ' + phone, '■ 회신 이메일: ' + email,
      '■ 회사·기관명: ' + (org || '-'), '■ 제작 품목: ' + item, '■ 예상 수량: ' + qty,
      '■ 희망 수령일: ' + (due || '-'), '', '■ 규격·용지 등 요청사항', notes || '-', ''];
    if (slug) lines.push('■ 참고 작품: ' + (workTitle || slug), '   ' + SITE + '/portfolio/' + slug + '/', '');
    lines.push('■ 첨부 파일: ' + (blobs.length ? blobs.map(function (b) { return b.getName(); }).join(', ') : '없음'), '',
      "※ 이 메일에서 '답장'을 누르면 고객 이메일(" + email + ')로 회신됩니다.');

    MailApp.sendEmail({ to: QUOTE_TO, subject: subject, body: lines.join('\n'), replyTo: email, name: '씨앤피시스템 홈페이지', attachments: blobs });
    return out_({ ok: true });   // 실제로 발송된 뒤에만 성공 응답
  } catch (err) {
    return out_({ ok: false, message: '메일을 보내지 못했습니다.' });
  }
}
