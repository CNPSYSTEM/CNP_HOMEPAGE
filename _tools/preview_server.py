# -*- coding: utf-8 -*-
"""씨앤피시스템 홈페이지 — 내 컴퓨터 미리보기 서버

실행:  python _tools/preview_server.py        (기본 주소 http://localhost:8790)

하는 일
  1) 사이트 파일을 GitHub Pages 와 같은 규칙으로 보여 줍니다.
     ( _ 또는 . 으로 시작하는 폴더·파일은 공개하지 않음 → 비공개 작품 보관 폴더 _private 는 주소로 열리지 않음 )
  2) 관리자 화면(/admin/)이 쓰는 저장 기능 (로그인 필요)
  3) 견적문의 메일 발송 (/api/quote)
     - 환경변수 SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS 가 있으면 실제로 메일을 보냅니다.
     - QUOTE_CAPTURE_DIR 가 있으면 보내지 않고 그 폴더에 .eml 파일로 저장합니다(시험용).
     - 둘 다 없으면 "메일 발송 설정 없음" 오류를 돌려줍니다 → 폼은 접수 완료를 표시하지 않습니다.
이 서버는 127.0.0.1(이 컴퓨터)에서만 접속됩니다.
"""
import base64
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import smtplib
import sys
import time
from email.header import Header
from email.message import EmailMessage
from email.utils import formataddr
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8790"))
PW_FILE = os.path.join(ROOT, "_tools", ".preview_password")
QUOTE_TO = "cnp3900@naver.com"
SITE = "https://cnpsystem.kr"
MAX_BODY = 60 * 1024 * 1024
MAX_FILES = 5
MAX_TOTAL = 15 * 1024 * 1024
ALLOWED_EXT = {"pdf", "ai", "psd", "jpg", "jpeg", "png", "zip", "hwp", "hwpx",
               "doc", "docx", "xls", "xlsx", "ppt", "pptx"}
SESSIONS = set()

mimetypes.add_type("application/javascript; charset=utf-8", ".js")
mimetypes.add_type("text/css; charset=utf-8", ".css")
mimetypes.add_type("application/json; charset=utf-8", ".json")
mimetypes.add_type("application/xml; charset=utf-8", ".xml")
mimetypes.add_type("image/webp", ".webp")


def admin_password():
    pw = os.environ.get("CNP_ADMIN_PW")
    if pw:
        return pw
    if not os.path.exists(PW_FILE):
        with open(PW_FILE, "w", encoding="utf-8") as f:
            f.write(secrets.token_urlsafe(9))
    with open(PW_FILE, encoding="utf-8") as f:
        return f.read().strip()


def safe_path(rel, for_write=False):
    """저장소 안의 경로만 허용. .git 과 _tools 는 관리자도 건드리지 못함."""
    rel = rel.replace("\\", "/").lstrip("/")
    parts = [p for p in rel.split("/") if p]
    if not parts or any(p in ("..", ".") for p in parts):
        raise ValueError("bad path")
    if parts[0] in (".git", "_tools") or parts[0].startswith(".git"):
        raise ValueError("forbidden path")
    full = os.path.normpath(os.path.join(ROOT, *parts))
    if not full.startswith(ROOT + os.sep):
        raise ValueError("bad path")
    return full


# ---------------------------------------------------------------- 견적 메일
def clean(v, limit):
    return re.sub(r"[\r\n\t]+", " ", str(v or "")).strip()[:limit]


def build_quote_mail(d):
    """견적 요청 → (EmailMessage, 오류문구). 운영용 Apps Script 와 같은 규칙."""
    name, phone, email = clean(d.get("name"), 40), clean(d.get("phone"), 30), clean(d.get("email"), 100)
    item, qty = clean(d.get("item"), 60), clean(d.get("qty"), 40)
    org, due = clean(d.get("org"), 60), clean(d.get("due"), 20)
    notes = str(d.get("notes") or "").strip()[:3000]
    if not (name and phone and email and item and qty):
        return None, "필수 항목이 비어 있습니다."
    if not re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$", email):
        return None, "이메일 주소 형식을 확인해 주세요."
    slug = clean(d.get("workSlug"), 60)
    work_title = clean(d.get("workTitle"), 100)
    if slug and not re.match(r"^[a-z0-9-]+$", slug):
        slug = ""

    files = d.get("files") or []
    if len(files) > MAX_FILES:
        return None, "파일은 최대 5개까지 첨부할 수 있습니다."
    decoded, total = [], 0
    for f in files:
        fname = os.path.basename(clean(f.get("name"), 120)) or "file"
        ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else ""
        if ext not in ALLOWED_EXT:
            return None, "첨부할 수 없는 형식입니다: " + fname
        try:
            raw = base64.b64decode(f.get("b64") or "", validate=True)
        except Exception:
            return None, "첨부 파일을 읽지 못했습니다: " + fname
        total += len(raw)
        decoded.append((fname, raw))
    if total > MAX_TOTAL:
        return None, "첨부 파일 합계가 15MB를 넘습니다."

    subject = "[홈페이지 견적] %s · %s · %s" % (item, qty, org or name)
    lines = [
        "홈페이지 견적문의가 접수되었습니다.", "",
        "■ 담당자명: " + name,
        "■ 연락처: " + phone,
        "■ 회신 이메일: " + email,
        "■ 회사·기관명: " + (org or "-"),
        "■ 제작 품목: " + item,
        "■ 예상 수량: " + qty,
        "■ 희망 수령일: " + (due or "-"),
        "", "■ 규격·용지 등 요청사항", notes or "-", "",
    ]
    if slug:
        lines += ["■ 참고 작품: " + (work_title or slug), "   %s/portfolio/%s/" % (SITE, slug), ""]
    lines += ["■ 첨부 파일: " + (", ".join(n for n, _ in decoded) if decoded else "없음"), "",
              "※ 이 메일에서 '답장'을 누르면 고객 이메일(%s)로 회신됩니다." % email]

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["To"] = QUOTE_TO
    msg["Reply-To"] = formataddr((str(Header(name, "utf-8")), email))
    msg.set_content("\n".join(lines))
    for fname, raw in decoded:
        ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
        main, sub = ctype.split(";")[0].split("/", 1)
        msg.add_attachment(raw, maintype=main, subtype=sub, filename=fname)
    return msg, None


def send_quote(d):
    """→ (http_status, dict)"""
    if d.get("website"):  # 자동 프로그램이 채우는 숨은 칸
        return 400, {"ok": False, "message": "전송하지 못했습니다."}
    msg, err = build_quote_mail(d)
    if err:
        return 400, {"ok": False, "message": err}
    capture = os.environ.get("QUOTE_CAPTURE_DIR")
    host = os.environ.get("SMTP_HOST")
    if capture:
        os.makedirs(capture, exist_ok=True)
        msg["From"] = "preview@localhost"
        with open(os.path.join(capture, "quote_%d.eml" % int(time.time() * 1000)), "wb") as f:
            f.write(bytes(msg))
        return 200, {"ok": True, "mode": "capture"}
    if not host:
        return 503, {"ok": False, "code": "not_configured",
                     "message": "메일 발송 설정이 아직 연결되지 않았습니다."}
    try:
        user, pw = os.environ["SMTP_USER"], os.environ["SMTP_PASS"]
        port = int(os.environ.get("SMTP_PORT", "465"))
        msg["From"] = formataddr((str(Header("씨앤피시스템 홈페이지", "utf-8")), user))
        if port == 465:
            with smtplib.SMTP_SSL(host, port, timeout=30) as s:
                s.login(user, pw)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, port, timeout=30) as s:
                s.starttls()
                s.login(user, pw)
                s.send_message(msg)
        return 200, {"ok": True}
    except Exception as e:  # 실패하면 접수 완료를 표시하지 않도록 오류로 응답
        sys.stderr.write("quote mail failed: %r\n" % (e,))
        return 502, {"ok": False, "message": "메일을 보내지 못했습니다."}


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "CNPPreview/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, status, body=b"", ctype="application/json; charset=utf-8", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _authed(self):
        m = re.search(r"cnp_admin=([A-Za-z0-9_\-]+)", self.headers.get("Cookie", ""))
        return bool(m and m.group(1) in SESSIONS)

    def _json_body(self):
        n = int(self.headers.get("Content-Length", "0"))
        if n > MAX_BODY:
            raise ValueError("too large")
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        u = urlparse(self.path)
        path = unquote(u.path)
        if path == "/api/session":
            return self._send(200, {"ok": self._authed(), "mode": "local"})
        if path == "/api/file":
            if not self._authed():
                return self._send(401, {"ok": False})
            try:
                full = safe_path(parse_qs(u.query).get("path", [""])[0])
                with open(full, "rb") as f:
                    data = f.read()
            except (ValueError, OSError):
                return self._send(404, {"ok": False})
            return self._send(200, data, mimetypes.guess_type(full)[0] or "application/octet-stream")
        return self._static(path)

    def _static(self, path):
        parts = [p for p in path.split("/") if p]
        hidden = any(p.startswith("_") or p.startswith(".") for p in parts) or ".." in parts
        full = os.path.join(ROOT, *parts) if parts else ROOT
        if not hidden and os.path.isdir(full):
            if not path.endswith("/"):
                return self._send(301, b"", "text/plain", {"Location": path + "/"})
            full = os.path.join(full, "index.html")
        if hidden or not os.path.isfile(full):
            try:
                with open(os.path.join(ROOT, "404.html"), "rb") as f:
                    return self._send(404, f.read(), "text/html; charset=utf-8")
            except OSError:
                return self._send(404, b"Not Found", "text/plain")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") and "charset" not in ctype:
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self._send(200, f.read(), ctype)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            data = self._json_body()
        except Exception:
            return self._send(400, {"ok": False, "message": "요청을 읽지 못했습니다."})

        if path == "/api/quote":
            status, body = send_quote(data)
            return self._send(status, body)

        if path == "/api/login":
            if hmac.compare_digest(str(data.get("password", "")), admin_password()):
                token = secrets.token_urlsafe(24)
                SESSIONS.add(token)
                return self._send(200, {"ok": True}, headers={
                    "Set-Cookie": "cnp_admin=%s; Path=/; HttpOnly; SameSite=Strict" % token})
            time.sleep(0.6)
            return self._send(401, {"ok": False, "message": "비밀번호가 맞지 않습니다."})

        if path == "/api/logout":
            m = re.search(r"cnp_admin=([A-Za-z0-9_\-]+)", self.headers.get("Cookie", ""))
            if m:
                SESSIONS.discard(m.group(1))
            return self._send(200, {"ok": True}, headers={"Set-Cookie": "cnp_admin=; Path=/; Max-Age=0"})

        if path == "/api/commit":
            if not self._authed():
                return self._send(401, {"ok": False, "message": "로그인이 필요합니다."})
            try:
                # 1) 모든 경로 검사 → 2) 쓰기 → 3) 옮기기 → 4) 지우기
                writes = [(safe_path(w["path"]), w) for w in data.get("writes", [])]
                moves = [(safe_path(m["from"]), safe_path(m["to"])) for m in data.get("moves", [])]
                deletes = [safe_path(p) for p in data.get("deletes", [])]
                for full, w in writes:
                    os.makedirs(os.path.dirname(full), exist_ok=True)
                    raw = base64.b64decode(w["b64"]) if "b64" in w else w["text"].encode("utf-8")
                    tmp = full + ".tmp"
                    with open(tmp, "wb") as f:
                        f.write(raw)
                    os.replace(tmp, full)
                for src, dst in moves:
                    if os.path.isfile(src):
                        os.makedirs(os.path.dirname(dst), exist_ok=True)
                        shutil.move(src, dst)
                for full in deletes:
                    if os.path.isfile(full):
                        os.remove(full)
                # 빈 폴더 정리
                for full in deletes + [s for s, _ in moves]:
                    d = os.path.dirname(full)
                    while d.startswith(ROOT + os.sep) and os.path.isdir(d) and not os.listdir(d):
                        os.rmdir(d)
                        d = os.path.dirname(d)
                return self._send(200, {"ok": True})
            except (ValueError, KeyError) as e:
                return self._send(400, {"ok": False, "message": "저장하지 못했습니다: %s" % e})
        return self._send(404, {"ok": False})


def main():
    # 선택: --port 8791  --capture <폴더>  (메일을 보내지 않고 .eml 로 저장하는 시험용)
    global PORT
    args = sys.argv[1:]
    if "--port" in args:
        PORT = int(args[args.index("--port") + 1])
    if "--capture" in args:
        os.environ["QUOTE_CAPTURE_DIR"] = args[args.index("--capture") + 1]
    admin_password()
    srv = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print("미리보기: http://localhost:%d/   관리자: http://localhost:%d/admin/" % (PORT, PORT))
    print("관리자 비밀번호 파일: %s" % PW_FILE)
    mode = "보관(시험)" if os.environ.get("QUOTE_CAPTURE_DIR") else ("SMTP" if os.environ.get("SMTP_HOST") else "설정 없음")
    print("견적 메일 발송: %s" % mode)
    srv.serve_forever()


if __name__ == "__main__":
    main()
