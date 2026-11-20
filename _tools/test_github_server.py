# -*- coding: utf-8 -*-
"""관리자 화면 시험용 — 가짜 GitHub 서버 (운영 사이트·실제 GitHub 와 완전히 분리)

실행:  python _tools/test_github_server.py        → http://localhost:8792/admin/   (열쇠: test-token-1)

하는 일
  - 임시 폴더에 진짜 git 저장소 두 개를 만든다:  TEST/SITE(공개 사이트 역할) · TEST/PRIVATE(비공개 보관함 역할)
      · SITE    = 이 폴더에서 "배포 대상"인 파일만 (.gitignore 로 빠지는 _private, 시험 사진 등은 제외)
      · PRIVATE = _private 폴더 내용
  - 관리자 화면이 쓰는 GitHub API(읽기·blob·tree·commit·ref)를 같은 모양으로 흉내 낸다.
  - SITE 저장소 최신 내용을 GitHub Pages 처럼 보여 준다( _ 로 시작하는 경로는 404 ).
  - 시험 편의: /fakegh/_ls?repo=TEST/SITE 파일 목록,  POST /fakegh/_expire 열쇠 만료 흉내
이 폴더의 파일은 바꾸지 않는다(읽기만). 127.0.0.1 에서만 접속된다.
"""
import base64
import json
import mimetypes
import os
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8792
BASE = tempfile.mkdtemp(prefix="cnp_ghtest_")
REPOS = {"TEST/SITE": os.path.join(BASE, "site.git"), "TEST/PRIVATE": os.path.join(BASE, "private.git")}
WWW = os.path.join(BASE, "www")
STATE = {"token": "test-token-1"}
ENV = dict(os.environ, GIT_AUTHOR_NAME="test", GIT_AUTHOR_EMAIL="test@localhost",
           GIT_COMMITTER_NAME="test", GIT_COMMITTER_EMAIL="test@localhost")
mimetypes.add_type("application/javascript; charset=utf-8", ".js")
mimetypes.add_type("text/css; charset=utf-8", ".css")

TEST_CONFIG = """window.CNP_ADMIN = { mode: "github", apiBase: "/fakegh", repo: "TEST/SITE", branch: "main",
  privateRepo: "", privateBranch: "main", siteUrl: "https://cnpsystem.kr", testLabel: "관리자 · 가짜 GitHub 시험" };
"""


def git(repo, *args, data=None, env=None, cwd=None):
    r = subprocess.run(["git", "--git-dir=" + repo] + list(args), input=data, capture_output=True,
                       env=env or ENV, cwd=cwd)
    if r.returncode:
        raise RuntimeError(r.stderr.decode("utf-8", "replace"))
    return r.stdout


def seed(repo, files):
    """files: [(저장소 안 경로, 실제 파일 경로)] → 첫 커밋"""
    subprocess.run(["git", "init", "--bare", "-q", "-b", "main", repo], check=True, env=ENV)
    env = dict(ENV, GIT_INDEX_FILE=os.path.join(repo, "seed.index"))
    for rel, full in files:
        sha = git(repo, "hash-object", "-w", full).decode().strip()
        git(repo, "update-index", "--add", "--cacheinfo", "100644,%s,%s" % (sha, rel), env=env)
    if not files:
        sha = git(repo, "hash-object", "-w", "--stdin", data=b"private\n").decode().strip()
        git(repo, "update-index", "--add", "--cacheinfo", "100644,%s,README.md" % sha, env=env)
    tree = git(repo, "write-tree", env=env).decode().strip()
    commit = git(repo, "commit-tree", tree, "-m", "seed").decode().strip()
    git(repo, "update-ref", "refs/heads/main", commit)


def publish_www():
    os.makedirs(WWW, exist_ok=True)
    subprocess.run(["git", "--git-dir=" + REPOS["TEST/SITE"], "--work-tree=" + WWW, "checkout", "-f", "-q", "main"],
                   check=True, env=ENV)


def setup():
    # 배포 대상 = git 이 추적하거나, 새 파일 중 .gitignore 에 걸리지 않는 것
    out = subprocess.run(["git", "ls-files", "-z", "-c", "-o", "--exclude-standard"], cwd=ROOT,
                         capture_output=True, check=True).stdout.decode("utf-8")
    site = [(p, os.path.join(ROOT, *p.split("/"))) for p in out.split("\0") if p]
    site = [(p, f) for p, f in site if os.path.isfile(f)]
    priv = []
    proot = os.path.join(ROOT, "_private")
    for d, _, names in os.walk(proot):
        for n in names:
            full = os.path.join(d, n)
            priv.append((os.path.relpath(full, proot).replace("\\", "/"), full))
    seed(REPOS["TEST/SITE"], site)
    seed(REPOS["TEST/PRIVATE"], priv)
    publish_www()
    return len(site), len(priv)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))

    def _send(self, status, body=b"", ctype="application/json; charset=utf-8"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", "0"))
        return json.loads(self.rfile.read(n).decode("utf-8") or "{}")

    def _api(self, method):
        u = urlparse(self.path)
        path = unquote(u.path)[len("/fakegh"):]
        q = parse_qs(u.query)
        if path == "/_expire" and method == "POST":
            STATE["token"] = "expired-" + STATE["token"]
            return self._send(200, {"ok": True})
        if path == "/_ls":
            repo = REPOS.get(q.get("repo", [""])[0])
            out = git(repo, "ls-tree", "-r", "-z", "--name-only", "main").decode("utf-8")
            return self._send(200, [p for p in out.split("\0") if p])
        if self.headers.get("Authorization", "") != "Bearer " + STATE["token"]:
            return self._send(401, {"message": "Bad credentials"})
        parts = path.split("/")  # ['', 'repos', owner, name, ...]
        if len(parts) < 4 or parts[1] != "repos" or (parts[2] + "/" + parts[3]) not in REPOS:
            return self._send(404, {"message": "Not Found"})
        repo = REPOS[parts[2] + "/" + parts[3]]
        rest = parts[4:]
        try:
            if not rest and method == "GET":
                return self._send(200, {"full_name": parts[2] + "/" + parts[3], "permissions": {"push": True}})
            if rest[0] == "contents" and method == "GET":
                ref = q.get("ref", ["main"])[0]
                try:
                    data = git(repo, "cat-file", "blob", "%s:%s" % (ref, "/".join(rest[1:])))
                except RuntimeError:
                    return self._send(404, {"message": "Not Found"})
                return self._send(200, data, "application/octet-stream")
            if rest[:3] == ["git", "ref", "heads"] and method == "GET":
                sha = git(repo, "rev-parse", "refs/heads/" + rest[3]).decode().strip()
                return self._send(200, {"ref": "refs/heads/" + rest[3], "object": {"sha": sha, "type": "commit"}})
            if rest[:2] == ["git", "commits"] and method == "GET":
                tree = git(repo, "rev-parse", rest[2] + "^{tree}").decode().strip()
                return self._send(200, {"sha": rest[2], "tree": {"sha": tree}})
            if rest[:2] == ["git", "trees"] and method == "GET":
                out = git(repo, "ls-tree", "-r", "-z", rest[2]).decode("utf-8")
                tree = []
                for line in out.split("\0"):
                    if line:
                        meta, p = line.split("\t", 1)
                        mode, typ, sha = meta.split()
                        tree.append({"path": p, "mode": mode, "type": typ, "sha": sha})
                return self._send(200, {"sha": rest[2], "tree": tree, "truncated": False})
            if rest[:2] == ["git", "blobs"] and method == "POST":
                d = self._body()
                raw = base64.b64decode(d["content"]) if d.get("encoding") == "base64" else d["content"].encode("utf-8")
                sha = git(repo, "hash-object", "-w", "--stdin", data=raw).decode().strip()
                return self._send(201, {"sha": sha})
            if rest[:2] == ["git", "trees"] and method == "POST":
                d = self._body()
                fd, idx = tempfile.mkstemp(prefix="idx_", dir=BASE)
                os.close(fd)
                os.remove(idx)
                env = dict(ENV, GIT_INDEX_FILE=idx)
                git(repo, "read-tree", d["base_tree"], env=env)
                for e in d["tree"]:
                    if "content" in e:
                        sha = git(repo, "hash-object", "-w", "--stdin", data=e["content"].encode("utf-8")).decode().strip()
                    else:
                        sha = e.get("sha")
                    if sha is None:
                        # bare 저장소에서도 되는 방식으로 색인에서 제거
                        git(repo, "update-index", "--index-info", env=env,
                            data=("0 %s\t%s\n" % ("0" * 40, e["path"])).encode("utf-8"))
                    else:
                        git(repo, "update-index", "--add", "--cacheinfo", "100644,%s,%s" % (sha, e["path"]), env=env)
                sha = git(repo, "write-tree", env=env).decode().strip()
                return self._send(201, {"sha": sha})
            if rest[:2] == ["git", "commits"] and method == "POST":
                d = self._body()
                args = ["commit-tree", d["tree"], "-m", d.get("message", "")]
                for p in d.get("parents", []):
                    args += ["-p", p]
                return self._send(201, {"sha": git(repo, *args).decode().strip()})
            if rest[:3] == ["git", "refs", "heads"] and method == "PATCH":
                d = self._body()
                git(repo, "update-ref", "refs/heads/" + rest[3], d["sha"])
                if repo == REPOS["TEST/SITE"]:
                    publish_www()  # GitHub Pages 반영 흉내
                return self._send(200, {"object": {"sha": d["sha"]}})
        except Exception as e:  # noqa
            return self._send(422, {"message": str(e)})
        return self._send(404, {"message": "Not Found"})

    def do_POST(self):
        return self._api("POST") if self.path.startswith("/fakegh/") else self._send(404, {})

    def do_PATCH(self):
        return self._api("PATCH") if self.path.startswith("/fakegh/") else self._send(404, {})

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.path.startswith("/fakegh/"):
            return self._api("GET")
        path = unquote(urlparse(self.path).path)
        if path == "/admin/config.js":
            return self._send(200, TEST_CONFIG.encode("utf-8"), "application/javascript; charset=utf-8")
        parts = [p for p in path.split("/") if p]
        hidden = any(p.startswith("_") or p.startswith(".") for p in parts) or ".." in parts
        full = os.path.join(WWW, *parts) if parts else WWW
        if not hidden and os.path.isdir(full):
            if not path.endswith("/"):
                self.send_response(301)
                self.send_header("Location", path + "/")
                self.end_headers()
                return
            full = os.path.join(full, "index.html")
        if hidden or not os.path.isfile(full):
            return self._send(404, b"Not Found", "text/plain")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") and "charset" not in ctype:
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            self._send(200, f.read(), ctype)


if __name__ == "__main__":
    n_site, n_priv = setup()
    print("가짜 GitHub 시험 서버: http://localhost:%d/admin/  (열쇠: %s)" % (PORT, STATE["token"]))
    print("임시 저장소: %s  · 사이트 파일 %d개 · 보관함 파일 %d개" % (BASE, n_site, n_priv))
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
