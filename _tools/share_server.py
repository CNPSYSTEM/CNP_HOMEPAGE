# -*- coding: utf-8 -*-
"""같은 와이파이의 휴대폰에서 보는 방문자용 미리보기 (읽기 전용)

실행:  python _tools/share_server.py      → http://<이 컴퓨터 IP>:8800/

공유하는 것 : 방문자용 페이지와 공개 중인 사진만 (보기만 가능)
공유 안 함  : 관리자 화면(/admin), 저장 기능(/api), 비공개 보관함(_private), 도구(_tools),
              _ 또는 . 으로 시작하는 모든 경로, 배포 제외 파일(시험 사진 등)
견적문의 폼은 화면만 보이며, 메일 발송 연결 전이라 전송되지 않습니다.
끄려면 이 창에서 Ctrl+C.
"""
import mimetypes
import os
import socket
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8800
BLOCK_TOP = {"admin", "readme.md", "cname"}
BLOCK_FILES = {"media/hero/hero-mwm8fvdo.jpg"}
ALLOW_EXT = {".html", ".css", ".js", ".json", ".xml", ".txt", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico"}

mimetypes.add_type("application/javascript; charset=utf-8", ".js")
mimetypes.add_type("text/css; charset=utf-8", ".css")
mimetypes.add_type("application/json; charset=utf-8", ".json")
mimetypes.add_type("image/webp", ".webp")


class Handler(BaseHTTPRequestHandler):
    server_version = "CNPShare/1.0"

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s %s\n" % (self.log_date_time_string(), self.client_address[0], fmt % args))

    def _send(self, status, body, ctype):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _404(self):
        try:
            with open(os.path.join(ROOT, "404.html"), "rb") as f:
                return self._send(404, f.read(), "text/html; charset=utf-8")
        except OSError:
            return self._send(404, b"Not Found", "text/plain")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        path = unquote(urlparse(self.path).path)
        parts = [p for p in path.split("/") if p]
        low = [p.lower() for p in parts]
        blocked = (any(p.startswith("_") or p.startswith(".") or p == ".." or "\\" in p for p in parts)
                   or (low and low[0] in BLOCK_TOP) or "/".join(low) in BLOCK_FILES)
        if blocked:
            return self._404()
        full = os.path.normpath(os.path.join(ROOT, *parts)) if parts else ROOT
        if full != ROOT and not full.startswith(ROOT + os.sep):
            return self._404()
        if os.path.isdir(full):
            if not path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", path + "/")
                self.end_headers()
                return
            full = os.path.join(full, "index.html")
        if not os.path.isfile(full) or os.path.splitext(full)[1].lower() not in ALLOW_EXT:
            return self._404()
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") and "charset" not in ctype:
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self._send(200, f.read(), ctype)

    # 보기 전용: 쓰기 요청은 모두 거절
    def _deny(self):
        self._send(405, b"Read only", "text/plain")

    do_POST = do_PUT = do_PATCH = do_DELETE = _deny


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


if __name__ == "__main__":
    print("휴대폰(같은 와이파이)에서 열 주소:  http://%s:%d/" % (lan_ip(), PORT))
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
