/* 씨앤피시스템 홈페이지 관리자
 * - 대문 사진 교체 · PC/모바일 초점 · 글자 가독성 미리보기
 * - 작품 등록/수정 · 사진 여러 장 · 대표 사진 · 썸네일 방식/초점 · 순서 · 임시저장/공개/비공개/재공개
 * 저장 위치
 *   내 컴퓨터 미리보기(localhost) : 미리보기 서버가 이 폴더 파일에 저장
 *   운영(cnpsystem.kr)            : GitHub 저장소에 직접 저장(커밋) → GitHub Pages 가 1~2분 뒤 반영
 * 공개 중단 원리: 비공개/임시저장 작품의 사진·내용은 _private/ 폴더에 둡니다.
 *   GitHub Pages 는 _ 로 시작하는 폴더를 사이트로 내보내지 않으므로 주소로 열리지 않습니다.
 */
(function () {
  "use strict";
  var CFG = window.CNP_ADMIN || {};
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var MODE = CFG.mode || (LOCAL ? "local" : "github");   // local: 미리보기 서버 / github: GitHub 저장소
  var API = CFG.apiBase || "https://api.github.com";
  var SITE = CFG.siteUrl || "https://cnpsystem.kr";
  var CONTENT_PATH = "_private/content.json";
  var app = document.getElementById("app");

  /* ------------------------------------------------------------ 작은 도구 */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    for (var k in attrs || {}) {
      var v = attrs[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.slice(0, 2) === "on") el.addEventListener(k.slice(2), v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { if (x) el.appendChild(x.nodeType ? x : document.createTextNode(x)); });
      else el.appendChild(c.nodeType ? c : document.createTextNode(c));
    }
    return el;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rid(n) { var s = ""; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
  function today() { return new Date().toISOString().slice(0, 10); }
  function b64utf8(b64) { return new TextDecoder().decode(Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); })); }

  var toastTimer;
  function toast(msg, isErr) {
    var t = document.getElementById("toast");
    t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, isErr ? 7000 : 3200);
  }
  var busyEl;
  function busy(msg) {
    if (msg) { if (!busyEl) { busyEl = h("div", { class: "busy" }); document.body.appendChild(busyEl); } busyEl.textContent = msg; }
    else if (busyEl) { busyEl.remove(); busyEl = null; }
  }

  /* ------------------------------------------------------------ 저장소 연결 */
  var LocalStore = {
    mode: "local",
    session: function () { return fetch("/api/session").then(function (r) { return r.json(); }).then(function (d) { return !!d.ok; }); },
    login: function (pw) {
      return fetch("/api/login", { method: "POST", body: JSON.stringify({ password: pw }) }).then(function (r) { return r.json(); })
        .then(function (d) { if (!d.ok) throw new Error(d.message || "로그인하지 못했습니다."); });
    },
    logout: function () { return fetch("/api/logout", { method: "POST", body: "{}" }); },
    readBlob: function (path) {
      return fetch("/api/file?path=" + encodeURIComponent(path)).then(function (r) { return r.ok ? r.blob() : null; });
    },
    readText: function (path) {
      return fetch("/api/file?path=" + encodeURIComponent(path)).then(function (r) { return r.ok ? r.text() : null; });
    },
    commit: function (ops) {
      return fetch("/api/commit", { method: "POST", body: JSON.stringify(ops) }).then(function (r) { return r.json(); })
        .then(function (d) { if (!d.ok) throw new Error(d.message || "저장하지 못했습니다."); });
    }
  };

  // 운영: 공개 저장소(사이트) + 비공개 저장소(보관함) 두 곳에 나눠 저장한다.
  //   "_private/…" 로 시작하는 경로 → 비공개 저장소 (임시저장·비공개 작품 사진, 전체 내용 content.json)
  //   그 밖의 경로               → 공개 저장소 (GitHub Pages 로 나가는 사이트 파일)
  function route(path) {
    if (CFG.privateRepo && path.indexOf("_private/") === 0) return { repo: CFG.privateRepo, branch: CFG.privateBranch || "main", path: path.slice(9), priv: true };
    return { repo: CFG.repo, branch: CFG.branch || "main", path: path, priv: false };
  }
  function blobToB64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(String(fr.result).split(",")[1] || ""); };
      fr.onerror = rej; fr.readAsDataURL(blob);
    });
  }
  var GitHubStore = {
    mode: "github",
    lastError: "",
    token: function () { try { return localStorage.getItem("cnp_admin_token") || ""; } catch (_) { return ""; } },
    api: function (path, opt) {
      opt = opt || {};
      var headers = { "Accept": opt.raw ? "application/vnd.github.raw" : "application/vnd.github+json", "Authorization": "Bearer " + this.token(), "X-GitHub-Api-Version": "2022-11-28" };
      return fetch(API + path, { method: opt.method || "GET", headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: "no-store" })
        .then(function (r) {
          if (r.status === 401) { var e = new Error("열쇠(토큰)가 만료되었거나 맞지 않습니다. 새 열쇠를 만들어 다시 로그인해 주세요."); e.expired = true; throw e; }
          if (opt.raw) return r.ok ? r : null;
          return r.json().then(function (d) { if (!r.ok) throw new Error("GitHub: " + (d.message || r.status)); return d; });
        });
    },
    session: function () {
      var self = this;
      self.lastError = "";
      if (!this.token()) return Promise.resolve(false);
      function canPush(repo, label) {
        return self.api("/repos/" + repo).then(function (d) {
          if (!(d.permissions && d.permissions.push)) throw new Error(label + "(" + repo + ")에 쓸 권한이 없습니다. 열쇠의 저장소 선택과 Contents: Read and write 권한을 확인해 주세요.");
        }, function (e) { throw e.expired ? e : new Error(label + "(" + repo + ")를 열 수 없습니다. 열쇠에 이 저장소가 포함되어 있는지 확인해 주세요."); });
      }
      return canPush(CFG.repo, "사이트 저장소").then(function () { return CFG.privateRepo ? canPush(CFG.privateRepo, "비공개 보관함 저장소") : null; })
        .then(function () { return true; }, function (e) { self.lastError = e.message; return false; });
    },
    login: function (token) {
      var self = this;
      localStorage.setItem("cnp_admin_token", token.trim());
      return this.session().then(function (ok) {
        if (!ok) { localStorage.removeItem("cnp_admin_token"); throw new Error(self.lastError || "로그인하지 못했습니다."); }
      });
    },
    logout: function () { localStorage.removeItem("cnp_admin_token"); return Promise.resolve(); },
    _contents: function (path) {
      var r = route(path);
      return "/repos/" + r.repo + "/contents/" + r.path.split("/").map(encodeURIComponent).join("/") + "?ref=" + encodeURIComponent(r.branch);
    },
    readBlob: function (path) { return this.api(this._contents(path), { raw: true }).then(function (r) { return r ? r.blob() : null; }); },
    readText: function (path) { return this.api(this._contents(path), { raw: true }).then(function (r) { return r ? r.text() : null; }); },
    // 저장소 한 곳에 변경을 한 번의 커밋으로 반영
    _commitRepo: function (repo, branch, ops, message) {
      if (!ops.writes.length && !ops.moves.length && !ops.deletes.length) return Promise.resolve();
      var self = this, R = "/repos/" + repo, base, baseTree, tree = [];
      return self.api(R + "/git/ref/heads/" + branch).then(function (ref) {
        base = ref.object.sha;
        return self.api(R + "/git/commits/" + base);
      }).then(function (c) {
        baseTree = c.tree.sha;
        return self.api(R + "/git/trees/" + baseTree + "?recursive=1");
      }).then(function (list) {
        var shaOf = {};
        list.tree.forEach(function (t) { if (t.type === "blob") shaOf[t.path] = t.sha; });
        ops.moves.forEach(function (m) {
          if (!shaOf[m.from]) return;
          tree.push({ path: m.to, mode: "100644", type: "blob", sha: shaOf[m.from] });
          tree.push({ path: m.from, mode: "100644", type: "blob", sha: null });
        });
        ops.deletes.forEach(function (p) { if (shaOf[p]) tree.push({ path: p, mode: "100644", type: "blob", sha: null }); });
        var chain = Promise.resolve();
        ops.writes.forEach(function (w) {
          if ("text" in w) tree.push({ path: w.path, mode: "100644", type: "blob", content: w.text });
          else chain = chain.then(function () {
            return self.api(R + "/git/blobs", { method: "POST", body: { content: w.b64, encoding: "base64" } })
              .then(function (b) { tree.push({ path: w.path, mode: "100644", type: "blob", sha: b.sha }); });
          });
        });
        return chain;
      }).then(function () {
        if (!tree.length) return null;
        return self.api(R + "/git/trees", { method: "POST", body: { base_tree: baseTree, tree: tree } }).then(function (t) {
          return self.api(R + "/git/commits", { method: "POST", body: { message: message || "관리자 화면에서 수정", tree: t.sha, parents: [base] } });
        }).then(function (c) {
          return self.api(R + "/git/refs/heads/" + branch, { method: "PATCH", body: { sha: c.sha } });
        });
      });
    },
    commit: function (ops, message) {
      var self = this;
      var pub = { writes: [], moves: [], deletes: [] }, priv = { writes: [], moves: [], deletes: [] };
      function side(r) { return r.priv ? priv : pub; }
      (ops.writes || []).forEach(function (w) { var r = route(w.path), o = { path: r.path }; if ("text" in w) o.text = w.text; else o.b64 = w.b64; side(r).writes.push(o); });
      (ops.deletes || []).forEach(function (p) { var r = route(p); side(r).deletes.push(r.path); });
      var cross = [];
      (ops.moves || []).forEach(function (m) {
        var f = route(m.from), t = route(m.to);
        if (f.priv === t.priv) side(f).moves.push({ from: f.path, to: t.path }); else cross.push({ m: m, f: f, t: t });
      });
      // 공개 ↔ 보관함 사이 이동: 한쪽에서 읽어 다른 쪽에 쓰고, 원래 자리에서는 지운다
      return cross.reduce(function (chain, c) {
        return chain.then(function () { return self.readBlob(c.m.from); }).then(function (blob) {
          if (!blob) return;
          return blobToB64(blob).then(function (b64) { side(c.t).writes.push({ path: c.t.path, b64: b64 }); side(c.f).deletes.push(c.f.path); });
        });
      }, Promise.resolve()).then(function () {
        // 사이트(공개) 먼저, 보관함(내용 기록) 나중 — 비공개로 내릴 때 사이트에서 먼저 사라지도록
        return self._commitRepo(CFG.repo, CFG.branch || "main", pub, message);
      }).then(function () {
        return CFG.privateRepo ? self._commitRepo(CFG.privateRepo, CFG.privateBranch || "main", priv, message) : null;
      });
    }
  };
  var LOCAL_MODE = MODE === "local";
  var store = LOCAL_MODE ? LocalStore : GitHubStore;

  /* ------------------------------------------------------------ 내용(데이터) */
  var content = null;
  var DEFAULT_CATEGORIES = ["리플렛·브로슈어", "책자·도서", "포스터", "현수막·배너", "스티커·라벨", "명함·봉투", "기타"];
  function emptyContent() {
    return { version: 1, hero: { image: "", w: 0, h: 0, posPc: [50, 50], posMo: [50, 50], scrim: 55, textColor: "white" }, categories: DEFAULT_CATEGORIES.slice(), works: [], order: [] };
  }
  function workById(id) { return content.works.filter(function (w) { return w.id === id; })[0]; }
  function baseOf(w, status) { return ((status || w.status) === "public" ? "media/works/" : "_private/media/works/") + w.id + "/"; }
  function fullPath(w, p, status) { return baseOf(w, status) + p.id + ".jpg"; }
  function thumbPath(w, p, status) { return baseOf(w, status) + p.id + "_t.jpg"; }
  function coverOf(w) { return w.photos.filter(function (p) { return p.id === w.cover; })[0] || w.photos[0]; }
  function publicWorks(c) {
    c = c || content;
    return c.order.map(function (id) { return c.works.filter(function (w) { return w.id === id; })[0]; })
      .filter(function (w) { return w && w.status === "public" && w.photos.length; });
  }

  // 사진 주소(관리자 화면용): 비공개 폴더 사진도 보여야 하므로 저장소에서 직접 읽어 온다
  var urlCache = {};
  function imgUrl(path) {
    if (urlCache[path]) return Promise.resolve(urlCache[path]);
    return store.readBlob(path).then(function (b) { if (!b) return ""; urlCache[path] = URL.createObjectURL(b); return urlCache[path]; });
  }
  function setImg(img, path) { imgUrl(path).then(function (u) { if (u) img.src = u; }); return img; }

  /* ------------------------------------------------------------ 사진 처리 */
  function drawScaled(bmp, max, quality) {
    var s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * s)), hh = Math.max(1, Math.round(bmp.height * s));
    var c = document.createElement("canvas"); c.width = w; c.height = hh;
    var x = c.getContext("2d");
    x.fillStyle = "#fff"; x.fillRect(0, 0, w, hh);
    x.imageSmoothingQuality = "high";
    x.drawImage(bmp, 0, 0, w, hh);
    var url = c.toDataURL("image/jpeg", quality);
    return { w: w, h: hh, url: url, b64: url.split(",")[1] };
  }
  function loadBitmap(file) {
    return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () {
      throw new Error("사진으로 읽을 수 없는 파일입니다: " + file.name + " (JPG · PNG · WEBP 사진을 올려 주세요)");
    });
  }
  // 사진 한 장 → 상세용(긴 변 2000) + 목록용(긴 변 900) 을 한 번에 만든다
  function processPhoto(file) {
    return loadBitmap(file).then(function (bmp) {
      var full = drawScaled(bmp, 2000, 0.86), th = drawScaled(bmp, 900, 0.82);
      return { photo: { id: "p" + rid(6), w: full.w, h: full.h, tw: th.w, th: th.h }, full: full, thumb: th };
    });
  }
  function coverCrop(bmpOrImg, sw, sh, W, H, pos, quality) {
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var s = Math.max(W / sw, H / sh), dw = sw * s, dh = sh * s;
    c.getContext("2d").drawImage(bmpOrImg, (W - dw) * pos[0] / 100, (H - dh) * pos[1] / 100, dw, dh);
    return c.toDataURL("image/jpeg", quality).split(",")[1];
  }

  /* ------------------------------------------------------------ 공개 파일 만들기 */
  var HOME_LIMIT = 16;   // 홈에는 4줄(PC 4열 × 4)까지만. 전체는 /portfolio/
  function gridHtml(c, limit) {
    var pubs = publicWorks(c);
    if (limit) pubs = pubs.slice(0, limit);
    if (!pubs.length) return '\n        <li class="grid-empty">작품을 준비하고 있습니다.</li>\n';
    return "\n" + pubs.map(function (w, i) {
      var p = coverOf(w), pos = w.thumbPos || [50, 50];
      var client = (w.client || "").trim();
      // 마우스를 올리거나 키보드로 선택했을 때 보이는 정보(작품명 · 고객사 · 화살표). 화면낭독기는 링크 이름으로 읽음
      var ov = '<span class="ov" aria-hidden="true"><span class="ov-t">' + esc(w.title) + '</span>' + (client ? '<span class="ov-c">' + esc(client) + '</span>' : '') + '<span class="ov-a">→</span></span>';
      return '        <li><a href="/portfolio/' + w.slug + '/" aria-label="' + esc(w.title + (client ? " · " + client : "")) + '"><img class="fit-' + (w.thumbFit === "contain" ? "contain" : "cover") +
        '" src="/' + thumbPath(w, p) + '" alt="' + esc(w.title) + '" width="' + p.tw + '" height="' + p.th + '" style="object-position:' + pos[0] + "% " + pos[1] + '%"' +
        (i < 8 ? "" : ' loading="lazy" decoding="async"') + ' />' + ov + '</a></li>';
    }).join("\n") + "\n";
  }
  function heroHtml(c) {
    var x = c.hero;
    if (!x.image) return "";
    var tc = x.textColor === "black" ? " t-black" : "";
    var free = x.layout === "free" && x.pc && x.mo;
    var style, pre = "";
    if (free) {
      var bg = /^#[0-9a-fA-F]{6}$/.test(x.bg || "") ? x.bg : "#ffffff";
      pre = '<div class="hero-bg" style="background:' + bg + '"></div>';
      style = ["pc", "mo"].map(function (k) {
        var v = x[k];
        return "--" + k + "-x:" + (+v.x || 0) + ";--" + k + "-y:" + (+v.y || 0) + ";--" + k + "-z:" + (+v.z || 100) + ";--" + k + "-f:" + (+v.f || 0);
      }).join(";");
    } else {
      style = "--pos-pc:" + x.posPc[0] + "% " + x.posPc[1] + "%;--pos-mo:" + x.posMo[0] + "% " + x.posMo[1] + "%";
    }
    return pre + '<img class="hero-img' + tc + (free ? " is-free" : "") + '" src="/' + x.image + '" alt="" width="' + x.w + '" height="' + x.h + '" fetchpriority="high" style="' + style + '" />' +
      '<div class="hero-scrim' + tc + '" style="--scrim:' + (x.scrim / 100).toFixed(2) + '"></div>';
  }
  function fillMarker(text, name, inner) {
    var a = "<!--" + name + ":START-->", b = "<!--" + name + ":END-->";
    var i = text.indexOf(a), j = text.indexOf(b);
    if (i < 0 || j < 0) throw new Error("페이지 틀에서 " + name + " 자리를 찾지 못했습니다.");
    return text.slice(0, i + a.length) + inner + text.slice(j);
  }
  function fillTokens(tpl, map) {
    Object.keys(map).forEach(function (k) { tpl = tpl.split("{{" + k + "}}").join(map[k]); });
    return tpl;
  }
  function workPageHtml(tpl, w) {
    var photos = w.photos.map(function (p, i) {
      return '      <img src="/' + fullPath(w, p) + '" alt="' + esc(w.title) + (w.photos.length > 1 ? " " + (i + 1) : "") + '" width="' + p.w + '" height="' + p.h + '" style="--ar:' + (p.w / p.h).toFixed(4) + ';--w:' + p.w + 'px"' + (p.w / p.h >= 1.9 ? ' class="is-wide"' : '') + (i ? ' loading="lazy"' : ' fetchpriority="high"') + ' decoding="async" />';
    }).join("\n");
    var desc = (w.desc || "").trim();
    var specs = (w.specs || []).filter(function (s) { return (s.k || "").trim() && (s.v || "").trim(); });
    var meta = desc ? desc.replace(/\s+/g, " ").slice(0, 120) : w.title + " — 씨앤피시스템이 디자인·인쇄·제작한 사례입니다.";
    return fillTokens(tpl, {
      TITLE: esc(w.title), SLUG: w.slug, DESC_META: esc(meta),
      OG_IMAGE: SITE + "/" + fullPath(w, coverOf(w)),
      PHOTOS: photos,
      DESC_BLOCK: desc ? '    <p class="work-desc">' + esc(desc) + "</p>\n" : "",
      SPECS_BLOCK: specs.length ? '    <dl class="work-specs">\n' + specs.map(function (s) { return "      <div><dt>" + esc(s.k.trim()) + "</dt><dd>" + esc(s.v.trim()) + "</dd></div>"; }).join("\n") + "\n    </dl>\n" : ""
    });
  }
  function sitemapXml(c) {
    var d = today();
    var urls = ["/", "/about/", "/portfolio/", "/contact/", "/guide/"].map(function (p) { return { loc: SITE + p, lastmod: d }; });
    publicWorks(c).forEach(function (w) { urls.push({ loc: SITE + "/portfolio/" + w.slug + "/", lastmod: w.updated || d }); });
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(function (u) { return "  <url><loc>" + u.loc + "</loc><lastmod>" + u.lastmod + "</lastmod></url>"; }).join("\n") + "\n</urlset>\n";
  }
  function siteJson(c) {
    return JSON.stringify({
      hero: c.hero,
      works: publicWorks(c).map(function (w) { var p = coverOf(w); return { slug: w.slug, title: w.title, client: w.client || "", thumb: "/" + thumbPath(w, p), fit: w.thumbFit, pos: w.thumbPos }; })
    }, null, 1) + "\n";
  }
  // pages: 다시 만들 작품 id 목록 또는 "all" / gonePages: 지울 상세 주소(slug) 목록
  function buildPublic(next, pages, gonePages) {
    var writes = [], deletes = [];
    return Promise.all([store.readText("index.html"), store.readText("portfolio/index.html"), store.readText("_templates/work.html")]).then(function (t) {
      if (!t[0] || !t[1] || !t[2]) throw new Error("페이지 틀 파일을 읽지 못했습니다.");
      var grid = gridHtml(next);
      writes.push({ path: "index.html", text: fillMarker(fillMarker(t[0], "HERO", heroHtml(next)), "WORKS", gridHtml(next, HOME_LIMIT)) });
      writes.push({ path: "portfolio/index.html", text: fillMarker(t[1], "WORKS", grid) });
      writes.push({ path: "sitemap.xml", text: sitemapXml(next) });
      writes.push({ path: "data/site.json", text: siteJson(next) });
      var targets = pages === "all" ? next.works : next.works.filter(function (w) { return (pages || []).indexOf(w.id) > -1; });
      targets.forEach(function (w) {
        var path = "portfolio/" + w.slug + "/index.html";
        if (w.status === "public" && w.photos.length) writes.push({ path: path, text: workPageHtml(t[2], w) });
        else deletes.push(path);
      });
      (gonePages || []).forEach(function (slug) { deletes.push("portfolio/" + slug + "/index.html"); });
      return { writes: writes, deletes: deletes };
    });
  }
  // 한 번에 저장: 내용(JSON) + 사진 변경 + 공개 페이지
  function commitAll(next, ops, pages, message, gonePages) {
    busy("저장하는 중…");
    return buildPublic(next, pages, gonePages).then(function (pub) {
      var all = {
        writes: (ops.writes || []).concat(pub.writes, [{ path: CONTENT_PATH, text: JSON.stringify(next, null, 1) + "\n" }]),
        moves: ops.moves || [],
        deletes: (ops.deletes || []).concat(pub.deletes)
      };
      return store.commit(all, message);
    }).then(function () {
      (ops.moves || []).forEach(function (m) { if (urlCache[m.from]) { urlCache[m.to] = urlCache[m.from]; delete urlCache[m.from]; } });
      content = next;
      busy();
    }, function (e) {
      busy();
      if (e && e.expired) { store.logout(); renderLogin(e.message); } else toast(e.message || "저장하지 못했습니다.", true);
      throw e;
    });
  }

  /* ------------------------------------------------------------ 끌어서 초점 옮기기 */
  // frame 안의 img 가 object-fit: cover 일 때, 끌면 object-position(%)을 바꾼다
  function makePannable(frame, getSize, getPos, setPos) {
    var start = null;
    frame.addEventListener("pointerdown", function (e) {
      var sz = getSize(); if (!sz || !sz.w) return;
      start = { x: e.clientX, y: e.clientY, pos: getPos().slice() };
      frame.setPointerCapture(e.pointerId); frame.classList.add("dragging");
    });
    frame.addEventListener("pointermove", function (e) {
      if (!start) return;
      var sz = getSize(), fw = frame.clientWidth, fh = frame.clientHeight;
      var s = Math.max(fw / sz.w, fh / sz.h), ox = fw - sz.w * s, oy = fh - sz.h * s; // 넘치는 양(음수)
      var x = start.pos[0], y = start.pos[1];
      if (ox < -0.5) x = start.pos[0] + (e.clientX - start.x) / ox * 100;
      if (oy < -0.5) y = start.pos[1] + (e.clientY - start.y) / oy * 100;
      setPos([Math.round(Math.min(100, Math.max(0, x))), Math.round(Math.min(100, Math.max(0, y)))]);
    });
    function end() { start = null; frame.classList.remove("dragging"); }
    frame.addEventListener("pointerup", end); frame.addEventListener("pointercancel", end);
    // 키보드: 화살표로 초점 이동
    frame.tabIndex = 0;
    frame.addEventListener("keydown", function (e) {
      var d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
      if (!d || !getSize()) return; e.preventDefault();
      var p = getPos();
      setPos([Math.min(100, Math.max(0, p[0] + d[0])), Math.min(100, Math.max(0, p[1] + d[1]))]);
    });
  }
  // 목록(타일)을 끌어서 순서 바꾸기 — list: 배열, onChange(newList)
  function makeSortable(container, selector, getList, onChange) {
    var dragId = null;
    container.addEventListener("dragstart", function (e) {
      var t = e.target.closest(selector); if (!t) return;
      dragId = t.dataset.id; t.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId);
    });
    container.addEventListener("dragend", function () {
      dragId = null;
      container.querySelectorAll(".dragging,.over").forEach(function (x) { x.classList.remove("dragging", "over"); });
    });
    container.addEventListener("dragover", function (e) {
      var t = e.target.closest(selector); if (!t || !dragId) return;
      e.preventDefault();
      container.querySelectorAll(".over").forEach(function (x) { x.classList.remove("over"); });
      if (t.dataset.id !== dragId) t.classList.add("over");
    });
    container.addEventListener("drop", function (e) {
      var t = e.target.closest(selector); if (!t || !dragId) return;
      e.preventDefault();
      var list = getList().slice(), from = list.indexOf(dragId), to = list.indexOf(t.dataset.id);
      if (from < 0 || to < 0 || from === to) return;
      list.splice(to, 0, list.splice(from, 1)[0]);
      onChange(list);
    });
  }
  function moveIn(list, id, delta) {
    list = list.slice(); var i = list.indexOf(id), j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return list;
    list.splice(j, 0, list.splice(i, 1)[0]); return list;
  }

  /* ------------------------------------------------------------ 화면: 로그인 */
  function renderLogin(msg) {
    var input = h("input", LOCAL_MODE ? { type: "password", id: "pw", autocomplete: "current-password", required: true } : { type: "password", id: "pw", autocomplete: "off", required: true, placeholder: "github_pat_…" });
    var err = h("p", { class: "err", text: msg || "", hidden: !msg });
    var form = h("form", { class: "login", onsubmit: function (e) {
      e.preventDefault(); err.hidden = true;
      store.login(input.value).then(start, function (ex) { err.textContent = ex.message; err.hidden = false; });
    } },
      h("h1", { text: "홈페이지 관리자" }),
      h("p", { text: LOCAL_MODE ? "내 컴퓨터 미리보기입니다. 관리자 비밀번호를 입력해 주세요." : "GitHub 열쇠(토큰)를 한 번 입력하면 이 컴퓨터의 이 브라우저에만 기억됩니다. 다른 컴퓨터에서는 처음 한 번 다시 입력합니다." }),
      h("label", { for: "pw", text: LOCAL_MODE ? "비밀번호" : "GitHub 열쇠(토큰)" }), input, err,
      h("button", { class: "btn", type: "submit", text: "로그인" }),
      LOCAL_MODE ? h("details", {}, h("summary", { text: "비밀번호는 어디에 있나요?" }), h("p", { text: "미리보기 서버를 켠 폴더의 _tools/.preview_password 파일에 적혀 있습니다." }))
        : h("details", {}, h("summary", { text: "열쇠(토큰) 만드는 방법" }), h("ul", {},
          h("li", { text: "GitHub 로그인 → Settings → Developer settings → Fine-grained tokens → Generate new token" }),
          h("li", { text: "Repository access: Only select repositories → " + CFG.repo + (CFG.privateRepo ? " 와 " + CFG.privateRepo + " 두 개 선택" : " 선택") }),
          h("li", { text: "Permissions → Contents: Read and write" }),
          h("li", { text: "만들어진 github_pat_… 값을 위 칸에 붙여 넣기" })))
    );
    app.replaceChildren(form); input.focus();
  }

  /* ------------------------------------------------------------ 화면: 틀 */
  var tab = "works", main;
  function renderShell() {
    main = h("div", { class: "wrap" });
    function tabBtn(id, label) { return h("button", { type: "button", role: "tab", "aria-selected": String(tab === id), text: label, onclick: function () { if (guardLeave()) { tab = id; renderShell(); } } }); }
    app.replaceChildren(
      h("div", { class: "top" },
        h("span", { class: "brand" }, "C&P SYSTEM", h("small", { text: LOCAL_MODE ? "관리자 · 미리보기" : (CFG.testLabel || "관리자") })),
        h("div", { class: "tabs", role: "tablist" }, tabBtn("works", "포트폴리오"), tabBtn("hero", "대문 사진")),
        h("div", { class: "right" },
          h("a", { class: "btn line small", href: "/", target: "_blank", rel: "noopener", text: "사이트 보기" }),
          h("button", { class: "btn line small", type: "button", text: "로그아웃", onclick: function () { store.logout().then(function () { location.reload(); }); } }))),
      main);
    if (tab === "hero") renderHero(); else renderWorks();
  }
  var leaveGuard = null;
  function guardLeave() { if (leaveGuard && !leaveGuard()) return false; leaveGuard = null; return true; }
  window.addEventListener("beforeunload", function (e) { if (leaveGuard && leaveGuard.dirty && leaveGuard.dirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ------------------------------------------------------------ 화면: 대문 사진 */
  function renderHero() {
    var d = clone(content.hero), pending = null, dirty = false;
    if (d.textColor !== "black") d.textColor = "white";
    if (d.layout !== "free") d.layout = "cover";
    d.bg = d.bg || "#ffffff";
    d.pc = d.pc || { x: 50, y: 50, z: 100, f: 0 };
    d.mo = d.mo || { x: 50, y: 50, z: 70, f: 0 };
    var parts = [], syncers = [];   // parts: {kind, fk, key, frame, img}
    function isFree() { return d.layout === "free"; }
    function apply() {
      parts.forEach(function (o) {
        var f = o.frame, st = o.img.style, v = d[o.fk];
        f.style.setProperty("--scrim", (d.scrim / 100).toFixed(2));
        f.classList.toggle("t-black", d.textColor === "black");
        f.classList.toggle("free", isFree());
        var lg = f.querySelector(".lg"), want = d.textColor === "black" ? "/assets/logo-cnp.svg" : "/assets/logo-cnp-white.svg";
        if (lg && lg.getAttribute("src") !== want) lg.setAttribute("src", want);
        if (isFree()) {
          f.style.background = d.bg;
          st.objectPosition = ""; st.height = v.z + "%"; st.left = v.x + "%"; st.top = v.y + "%";
          var m = "linear-gradient(to bottom, #000 " + (100 - v.f) + "%, transparent 100%)";
          st.webkitMaskImage = m; st.maskImage = m;
        } else {
          f.style.background = "";
          st.height = ""; st.left = ""; st.top = ""; st.webkitMaskImage = ""; st.maskImage = "";
          st.objectPosition = d[o.key][0] + "% " + d[o.key][1] + "%";
        }
      });
      scrimVal.textContent = d.scrim + "%";
      scrimLabel.textContent = d.textColor === "black" ? "글자 뒤 밝게" : "글자 뒤 어둡게";
      freeBox.hidden = !isFree();
      syncers.forEach(function (fn) { fn(); });
      saveBtn.disabled = !dirty || !(d.image || pending);
    }
    function frame(kind, key, label) {
      var fk = kind;   // "pc" | "mo"
      var img = h("img", { alt: "" });
      if (pending) img.src = pending.url; else if (d.image) setImg(img, d.image);
      var f = h("div", { class: "pv " + kind, role: "group", "aria-label": label + " 사진 위치 조절 (끌거나 화살표 키)" }, img, h("div", { class: "scrim" }),
        h("div", { class: "hd" }, h("i", {}, h("img", { class: "lg", alt: "C&P SYSTEM", src: "/assets/logo-cnp.svg" })), h("span", { text: "회사소개   포트폴리오   견적문의   안내" })),
        h("div", { class: "tx" }, h("b", {}, "우리가 디자인하고,", h("br"), "우리가 인쇄합니다."),
          h("span", { class: "ko", text: "씨앤피시스템의 디자인과 인쇄로 귀사의 브랜드를 업그레이드하세요." }),
          h("span", { class: "en", lang: "en", text: "Upgrade your brand with C&P System's design and printing." })));
      // 채우기 구도: 끌어서 초점 이동
      makePannable(f, function () { return isFree() ? null : { w: d.w, h: d.h }; }, function () { return d[key]; }, function (p) { d[key] = p; dirty = true; apply(); });
      // 배경 위에 놓기 구도: 끌어서 사진 자체를 이동
      var start = null;
      f.addEventListener("pointerdown", function (e) { if (!isFree()) return; start = { x: e.clientX, y: e.clientY, vx: d[fk].x, vy: d[fk].y }; f.setPointerCapture(e.pointerId); f.classList.add("dragging"); });
      f.addEventListener("pointermove", function (e) {
        if (!start || !isFree()) return;
        d[fk].x = Math.round((start.vx + (e.clientX - start.x) / f.clientWidth * 100) * 10) / 10;
        d[fk].y = Math.round((start.vy + (e.clientY - start.y) / f.clientHeight * 100) * 10) / 10;
        dirty = true; apply();
      });
      function end() { start = null; f.classList.remove("dragging"); }
      f.addEventListener("pointerup", end); f.addEventListener("pointercancel", end);
      f.addEventListener("keydown", function (e) {
        var k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!k || !isFree()) return; e.preventDefault();
        d[fk].x += k[0]; d[fk].y += k[1]; dirty = true; apply();
      });
      parts.push({ kind: kind, fk: fk, key: key, frame: f, img: img });
      return h("div", { class: "pv-col " + kind }, h("p", { class: "pv-label", text: label }), f);
    }
    function sampleBg(bmp) {   // 사진 왼쪽 위 색을 배경색으로 제안
      try {
        var c = document.createElement("canvas"); c.width = c.height = 1;
        var x = c.getContext("2d"); x.drawImage(bmp, 2, 2, 1, 1, 0, 0, 1, 1);
        var p = x.getImageData(0, 0, 1, 1).data;
        return "#" + [p[0], p[1], p[2]].map(function (n) { return ("0" + n.toString(16)).slice(-2); }).join("");
      } catch (_) { return "#ffffff"; }
    }
    var file = h("input", { type: "file", accept: "image/*", hidden: true, onchange: function () {
      var f = file.files[0]; if (!f) return;
      busy("사진을 준비하는 중…");
      loadBitmap(f).then(function (bmp) {
        var big = drawScaled(bmp, 2600, 0.9);
        pending = { url: big.url, b64: big.b64, bmp: bmp };
        d.w = big.w; d.h = big.h; d.posPc = [50, 50]; d.posMo = [50, 50];
        d.pc = { x: 50, y: 50, z: 100, f: 0 }; d.mo = { x: 50, y: 50, z: 70, f: 0 };
        d.bg = sampleBg(bmp); dirty = true;
        parts.forEach(function (o) { o.img.src = big.url; });
        apply(); busy();
      }).catch(function (e) { busy(); toast(e.message, true); });
      file.value = "";
    } });
    var scrimVal = h("span", { class: "note" }), scrimLabel = h("span", {});
    function radio(name, val, label, get, set) {
      return h("label", {}, h("input", { type: "radio", name: name, value: val, checked: get() === val, onchange: function () { set(val); dirty = true; apply(); } }), label);
    }
    var range = h("input", { type: "range", min: "0", max: "85", step: "5", value: String(d.scrim), oninput: function () { d.scrim = +range.value; dirty = true; apply(); } });
    function slider(label, fk, prop, min, max, unit) {
      var val = h("span", { class: "v" });
      var r = h("input", { type: "range", min: String(min), max: String(max), step: "1", oninput: function () { d[fk][prop] = +r.value; dirty = true; apply(); } });
      syncers.push(function () { r.value = String(d[fk][prop]); val.textContent = d[fk][prop] + unit; });
      return h("label", {}, label, r, val);
    }
    var color = h("input", { type: "color", value: d.bg, oninput: function () { d.bg = color.value; dirty = true; apply(); } });
    syncers.push(function () { if (/^#[0-9a-fA-F]{6}$/.test(d.bg)) color.value = d.bg; });
    var freeBox = h("div", { class: "freebox" },
      h("label", {}, "배경색", color),
      slider("PC 사진 크기", "pc", "z", 30, 220, "%"), slider("PC 아래쪽 흐리게", "pc", "f", 0, 40, "%"),
      slider("모바일 사진 크기", "mo", "z", 30, 220, "%"), slider("모바일 아래쪽 흐리게", "mo", "f", 0, 40, "%"));
    var saveBtn = h("button", { class: "btn", type: "button", text: "저장하고 사이트에 반영", onclick: save });

    function save() {
      var next = clone(content), ops = { writes: [], deletes: [] };
      var done = Promise.resolve();
      if (pending) {
        d.image = "media/hero/hero-" + Date.now().toString(36) + ".jpg";
        ops.writes.push({ path: d.image, b64: pending.b64 });
        if (content.hero.image) ops.deletes.push(content.hero.image);
        ops.writes.push({ path: "media/og.jpg", b64: coverCrop(pending.bmp, pending.bmp.width, pending.bmp.height, 1200, 630, d.posPc, 0.84) });
        urlCache[d.image] = pending.url;
      } else if (d.image) {
        // 초점만 바꾼 경우에도 공유용 이미지(og.jpg)를 새 초점으로 다시 만든다
        done = imgUrl(d.image).then(function (u) {
          return new Promise(function (res) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; });
        }).then(function (im) { if (im) ops.writes.push({ path: "media/og.jpg", b64: coverCrop(im, im.naturalWidth, im.naturalHeight, 1200, 630, d.posPc, 0.84) }); });
      }
      done.then(function () {
        next.hero = d;
        return commitAll(next, ops, [], "대문 사진 변경");
      }).then(function () { toast("대문 사진을 저장했습니다."); leaveGuard = null; renderShell(); }, function () {});
    }

    main.replaceChildren(
      h("div", { class: "h" }, h("h2", { text: "대문 사진" })),
      h("div", { class: "card" },
        h("h3", { text: "PC · 모바일 미리보기" }),
        h("p", { class: "note", text: "사진을 끌어서 화면마다 보이는 위치를 맞추세요. 문구가 잘 읽히는지도 여기서 확인합니다. (PC = 가로 화면, 모바일 = 세로 화면)" }),
        h("div", { class: "pv-row" }, frame("pc", "posPc", "PC 화면"), frame("mo", "posMo", "모바일 화면")),
        h("div", { class: "ctrl" },
          file,
          h("button", { class: "btn line", type: "button", text: "사진 바꾸기", onclick: function () { file.click(); } }),
          h("span", { class: "seg", role: "radiogroup", "aria-label": "사진 구도" }, h("b", { text: "구도" }),
            radio("hero-layout", "cover", "화면 가득 채우기", function () { return d.layout; }, function (v) { d.layout = v; }),
            radio("hero-layout", "free", "배경 위에 놓기", function () { return d.layout; }, function (v) { d.layout = v; })),
          h("span", { class: "seg", role: "radiogroup", "aria-label": "대문 문구색" }, h("b", { text: "문구색" }),
            radio("hero-color", "white", "흰색", function () { return d.textColor; }, function (v) { d.textColor = v; }),
            radio("hero-color", "black", "검정", function () { return d.textColor; }, function (v) { d.textColor = v; })),
          h("label", {}, scrimLabel, range, scrimVal)),
        freeBox,
        h("div", { class: "ctrl" }, saveBtn)),
      h("p", { class: "note", text: "‘화면 가득 채우기’는 풍경·현장 사진에, ‘배경 위에 놓기’는 흰 배경의 제작물 사진처럼 위치와 크기를 직접 잡고 싶을 때 씁니다. 권장: 가로 2400px 이상." }));
    apply();
    leaveGuard = function () { return !dirty || confirm("저장하지 않은 변경이 있습니다. 나가시겠어요?"); };
    leaveGuard.dirty = function () { return dirty; };
  }

  /* ------------------------------------------------------------ 화면: 작품 목록 */
  function tileImg(w) {
    var p = coverOf(w), pos = w.thumbPos || [50, 50];
    var img = h("img", { alt: w.title, class: "fit-" + (w.thumbFit === "contain" ? "contain" : "cover"), draggable: "false", style: { objectPosition: pos[0] + "% " + pos[1] + "%" } });
    if (p) setImg(img, thumbPath(w, p));
    return img;
  }
  function renderWorks() {
    var order = content.order.filter(function (id) { var w = workById(id); return w && w.status === "public"; });
    var orderDirty = false;
    var grid = h("div", { class: "agrid", "aria-label": "공개 중인 작품 (PC 4열 미리보기)" });
    var bar = h("div", { class: "dirtybar", hidden: true }, "순서가 바뀌었습니다.",
      h("button", { class: "btn", type: "button", text: "순서 저장", onclick: saveOrder }));
    function drawGrid() {
      grid.replaceChildren.apply(grid, order.map(function (id, i) {
        var w = workById(id);
        return h("div", { class: "tile", draggable: "true", "data-id": id },
          h("button", { class: "sq", type: "button", title: "편집: " + w.title, "aria-label": "편집: " + w.title, onclick: function () { if (guardLeave()) renderEditor(id); } }, tileImg(w)),
          h("div", { class: "cap" }, h("span", { class: "t", text: w.title }),
            h("button", { type: "button", "aria-label": "앞으로", text: "◀", disabled: i === 0, onclick: function () { setOrder(moveIn(order, id, -1)); } }),
            h("button", { type: "button", "aria-label": "뒤로", text: "▶", disabled: i === order.length - 1, onclick: function () { setOrder(moveIn(order, id, 1)); } })));
      }));
      bar.hidden = !orderDirty;
    }
    function setOrder(list) { order = list; orderDirty = true; drawGrid(); }
    function saveOrder() {
      var next = clone(content); next.order = order.slice();
      commitAll(next, {}, [], "작품 순서 변경").then(function () { orderDirty = false; toast("순서를 저장했습니다."); drawGrid(); }, function () {});
    }
    makeSortable(grid, ".tile", function () { return order; }, setOrder);

    function smallList(status, emptyText) {
      var list = content.works.filter(function (w) { return w.status === status; });
      if (!list.length) return h("p", { class: "empty", text: emptyText });
      return h("div", { class: "agrid small" }, list.map(function (w) {
        return h("div", { class: "tile" },
          h("button", { class: "sq", type: "button", "aria-label": "편집: " + w.title, onclick: function () { if (guardLeave()) renderEditor(w.id); } }, tileImg(w)),
          h("div", { class: "cap" }, h("span", { class: "t", text: w.title || "(제목 없음)" })));
      }));
    }
    var nDraft = content.works.filter(function (w) { return w.status === "draft"; }).length;
    var nPriv = content.works.filter(function (w) { return w.status === "private"; }).length;
    main.replaceChildren(
      h("div", { class: "h" }, h("h2", { text: "포트폴리오" }),
        h("div", { class: "sp" },
          h("button", { class: "btn line small", type: "button", text: "사이트 전체 다시 만들기", title: "목록·상세 페이지·사이트맵을 모두 새로 만듭니다", onclick: function () {
            commitAll(clone(content), {}, "all", "사이트 전체 다시 만들기").then(function () { toast("사이트 파일을 모두 다시 만들었습니다."); }, function () {});
          } }),
          h("button", { class: "btn", type: "button", text: "＋ 새 작품", onclick: function () { if (guardLeave()) renderEditor(null); } }))),
      h("p", { class: "sec-title" }, "공개 중 ", h("small", { text: order.length + "개 · 사이트 목록과 같은 순서 (PC 4열 미리보기) · 끌어서 순서 변경, 사진을 누르면 편집" })),
      order.length ? grid : h("p", { class: "empty", text: "공개 중인 작품이 없습니다." }),
      h("p", { class: "sec-title" }, "임시저장 ", h("small", { text: nDraft + "개 · 아직 사이트에 올리지 않은 작품" + (LOCAL_MODE || CFG.privateRepo ? "" : " (저장소에는 올라가므로 공개해도 되는 사진만)") })),
      smallList("draft", "임시저장한 작품이 없습니다."),
      h("p", { class: "sec-title" }, "비공개 ", h("small", { text: nPriv + "개 · 사진과 내용은 보관, 사이트에서는 보이지 않음" })),
      smallList("private", "비공개로 내린 작품이 없습니다."),
      bar);
    drawGrid();
    leaveGuard = function () { return !orderDirty || confirm("순서를 저장하지 않았습니다. 나가시겠어요?"); };
    leaveGuard.dirty = function () { return orderDirty; };
  }

  /* ------------------------------------------------------------ 화면: 작품 편집 */
  function renderEditor(id) {
    var orig = id ? workById(id) : null;
    var w = orig ? clone(orig) : { id: "w" + rid(8), slug: "", title: "", status: "draft", client: "", category: "", desc: "", specs: [], photos: [], cover: "", thumbFit: "cover", thumbPos: [50, 50], created: today(), updated: today() };
    var pending = {}; // 새로 올린 사진: photoId → {full, thumb}
    var dirty = false;
    var cats = content.categories.slice();
    function touch() { dirty = true; }
    function srcOf(img, p, thumb) {
      if (pending[p.id]) img.src = (thumb ? pending[p.id].thumb : pending[p.id].full).url;
      else setImg(img, thumb ? thumbPath(orig, p) : fullPath(orig, p));
      return img;
    }

    var title = h("input", { type: "text", id: "w-title", maxlength: "80", value: w.title, oninput: function () { w.title = title.value; touch(); } });
    var clientIn = h("input", { type: "text", id: "w-client", maxlength: "60", value: w.client || "", placeholder: "예: ○○기관", oninput: function () { w.client = clientIn.value; touch(); } });
    var catSel = h("select", { id: "w-cat", onchange: function () {
      if (catSel.value === "__new") {
        var n = (prompt("새 분야 이름") || "").trim();
        if (n && cats.indexOf(n) < 0) cats.push(n);
        w.category = n || w.category; drawCats();
      } else w.category = catSel.value;
      touch();
    } });
    function drawCats() {
      catSel.replaceChildren.apply(catSel, [h("option", { value: "", text: "(분야 없음)" })].concat(
        cats.map(function (c) { return h("option", { value: c, text: c, selected: c === w.category }); }),
        [h("option", { value: "__new", text: "＋ 새 분야 추가…" })]));
    }
    drawCats();

    // 사진
    var photosEl = h("div", { class: "photos" });
    var fileIn = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: function () { addFiles(fileIn.files); fileIn.value = ""; } });
    var drop = h("div", { class: "drop", role: "button", tabindex: "0", text: "여기를 눌러 사진을 고르거나, 사진 여러 장을 끌어다 놓으세요",
      onclick: function () { fileIn.click(); },
      onkeydown: function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileIn.click(); } },
      ondragover: function (e) { e.preventDefault(); drop.classList.add("over"); },
      ondragleave: function () { drop.classList.remove("over"); },
      ondrop: function (e) { e.preventDefault(); drop.classList.remove("over"); addFiles(e.dataTransfer.files); } });
    function addFiles(files) {
      files = Array.prototype.slice.call(files || []);
      if (!files.length) return;
      busy("사진을 준비하는 중… (0/" + files.length + ")");
      var n = 0, errs = [];
      files.reduce(function (chain, f) {
        return chain.then(function () { return processPhoto(f); }).then(function (r) {
          w.photos.push(r.photo); pending[r.photo.id] = r;
          if (!w.cover) w.cover = r.photo.id;
        }, function (e) { errs.push(e.message); }).then(function () { busy("사진을 준비하는 중… (" + (++n) + "/" + files.length + ")"); });
      }, Promise.resolve()).then(function () { busy(); touch(); drawPhotos(); drawThumb(); if (errs.length) toast(errs.join("\n"), true); });
    }
    function drawPhotos() {
      photosEl.replaceChildren.apply(photosEl, w.photos.map(function (p, i) {
        var isCover = p.id === w.cover;
        return h("div", { class: "ph" + (isCover ? " cover" : ""), draggable: "true", "data-id": p.id },
          h("div", { class: "im" }, srcOf(h("img", { alt: "사진 " + (i + 1) }), p, true)),
          h("div", { class: "bar" },
            h("button", { type: "button", class: "cv", text: isCover ? "★ 대표" : "대표로", "aria-pressed": String(isCover), onclick: function () { w.cover = p.id; w.thumbPos = [50, 50]; touch(); drawPhotos(); drawThumb(); } }),
            h("button", { type: "button", "aria-label": "앞으로", text: "◀", disabled: i === 0, onclick: function () { reorder(moveIn(ids(), p.id, -1)); } }),
            h("button", { type: "button", "aria-label": "뒤로", text: "▶", disabled: i === w.photos.length - 1, onclick: function () { reorder(moveIn(ids(), p.id, 1)); } }),
            h("button", { type: "button", text: "삭제", onclick: function () {
              w.photos = w.photos.filter(function (x) { return x.id !== p.id; }); delete pending[p.id];
              if (w.cover === p.id) { w.cover = w.photos[0] ? w.photos[0].id : ""; w.thumbPos = [50, 50]; }
              touch(); drawPhotos(); drawThumb();
            } })));
      }));
    }
    function ids() { return w.photos.map(function (p) { return p.id; }); }
    function reorder(list) { w.photos = list.map(function (pid) { return w.photos.filter(function (p) { return p.id === pid; })[0]; }); touch(); drawPhotos(); }
    makeSortable(photosEl, ".ph", ids, reorder);

    // 썸네일
    var thumbImg = h("img", { alt: "썸네일 미리보기" });
    var thumbPv = h("div", { class: "thumbpv", role: "group", "aria-label": "썸네일 초점 조절 (끌거나 화살표 키)" }, thumbImg);
    makePannable(thumbPv, function () { var c = coverOf(w); return c && w.thumbFit !== "contain" ? { w: c.tw, h: c.th } : null; },
      function () { return w.thumbPos; }, function (p) { w.thumbPos = p; touch(); applyThumb(); });
    function applyThumb() {
      thumbImg.className = "fit-" + w.thumbFit;
      thumbImg.style.objectPosition = w.thumbPos[0] + "% " + w.thumbPos[1] + "%";
      thumbPv.classList.toggle("pan", w.thumbFit !== "contain");
    }
    function drawThumb() {
      var c = coverOf(w);
      if (c) srcOf(thumbImg, c, true); else thumbImg.removeAttribute("src");
      applyThumb();
    }
    function fitRadio(val, label) {
      return h("label", {}, h("input", { type: "radio", name: "fit", value: val, checked: w.thumbFit === val, onchange: function () { w.thumbFit = val; touch(); applyThumb(); } }), label);
    }

    // 설명 · 사양
    var desc = h("textarea", { id: "w-desc", rows: "4", maxlength: "2000", oninput: function () { w.desc = desc.value; touch(); } });
    desc.value = w.desc || "";
    var specsEl = h("div", { class: "specs" });
    function drawSpecs() {
      specsEl.replaceChildren.apply(specsEl, w.specs.map(function (s, i) {
        var k = h("input", { type: "text", value: s.k, placeholder: "항목 (예: 규격)", "aria-label": "사양 항목", maxlength: "20", oninput: function () { s.k = k.value; touch(); } });
        var v = h("input", { type: "text", value: s.v, placeholder: "내용 (예: A4 · 16쪽)", "aria-label": "사양 내용", maxlength: "120", oninput: function () { s.v = v.value; touch(); } });
        return h("div", { class: "srow" }, k, v, h("button", { class: "btn line small", type: "button", text: "삭제", onclick: function () { w.specs.splice(i, 1); touch(); drawSpecs(); } }));
      }).concat([h("button", { class: "btn line small", type: "button", text: "＋ 사양 항목 추가", onclick: function () { w.specs.push({ k: "", v: "" }); drawSpecs(); } })]));
    }
    drawSpecs();

    /* 저장 */
    function save(target) {
      w.title = w.title.trim();
      w.client = (w.client || "").trim();
      if (!w.title) { toast("작품명을 입력해 주세요.", true); title.focus(); return; }
      if (!w.photos.length) { toast("사진을 한 장 이상 올려 주세요.", true); drop.focus(); return; }
      var next = clone(content), ops = { writes: [], moves: [], deletes: [] };
      var oldStatus = orig ? orig.status : null;
      w.status = target; w.updated = today();
      w.specs = w.specs.filter(function (s) { return (s.k || "").trim() || (s.v || "").trim(); });
      if (!w.slug) w.slug = "w" + today().slice(2).replace(/-/g, "") + "-" + rid(3);
      if (w.category && next.categories.indexOf(w.category) < 0) next.categories.push(w.category);
      w.photos.forEach(function (p) {
        if (pending[p.id]) {
          ops.writes.push({ path: fullPath(w, p), b64: pending[p.id].full.b64 }, { path: thumbPath(w, p), b64: pending[p.id].thumb.b64 });
        } else if (orig && baseOf(orig) !== baseOf(w)) { // 공개 ↔ 비공개: 사진을 공개 폴더와 보관 폴더 사이에서 옮김
          ops.moves.push({ from: fullPath(orig, p), to: fullPath(w, p) }, { from: thumbPath(orig, p), to: thumbPath(w, p) });
        }
      });
      if (orig) orig.photos.forEach(function (p) {
        if (!w.photos.some(function (x) { return x.id === p.id; })) ops.deletes.push(fullPath(orig, p), thumbPath(orig, p));
      });
      var saved = clone(w);
      var i = next.works.findIndex(function (x) { return x.id === w.id; });
      if (i < 0) next.works.unshift(saved); else next.works[i] = saved;
      next.order = next.order.filter(function (x) { return x !== w.id; });
      if (target === "public") { // 새로 공개하면 맨 앞, 이미 공개 중이면 자리 유지
        var oldIdx = oldStatus === "public" ? content.order.indexOf(w.id) : -1;
        if (oldIdx < 0) next.order.unshift(w.id); else next.order.splice(Math.min(oldIdx, next.order.length), 0, w.id);
      }
      var label = { draft: "임시저장", public: oldStatus === "private" ? "재공개" : (oldStatus === "public" ? "수정" : "공개"), private: oldStatus === "public" ? "비공개로 내림" : "저장" }[target];
      commitAll(next, ops, [w.id], "작품 " + label + ": " + w.title).then(function () {
        w.photos.forEach(function (p) {
          if (pending[p.id]) { urlCache[fullPath(w, p)] = pending[p.id].full.url; urlCache[thumbPath(w, p)] = pending[p.id].thumb.url; }
        });
        toast({ draft: "임시저장했습니다. (사이트에는 보이지 않습니다)", public: "공개했습니다." + (LOCAL_MODE ? "" : " 사이트 반영까지 1~2분 걸립니다."), private: "비공개로 저장했습니다. 목록과 상세 주소에서 내려갑니다." }[target]);
        leaveGuard = null; renderWorks();
      }, function () { w.status = oldStatus || "draft"; });
    }
    function remove() {
      if (!orig) { leaveGuard = null; renderWorks(); return; }
      if (!confirm("'" + orig.title + "' 작품을 완전히 삭제할까요?\n사진과 내용이 모두 지워지며 되돌릴 수 없습니다.\n(보관만 하려면 '비공개로 내리기'를 쓰세요)")) return;
      var next = clone(content), ops = { deletes: [] };
      orig.photos.forEach(function (p) { ops.deletes.push(fullPath(orig, p), thumbPath(orig, p)); });
      next.works = next.works.filter(function (x) { return x.id !== orig.id; });
      next.order = next.order.filter(function (x) { return x !== orig.id; });
      commitAll(next, ops, [], "작품 삭제: " + orig.title, orig.slug ? [orig.slug] : []).then(function () { toast("삭제했습니다."); leaveGuard = null; renderWorks(); }, function () {});
    }

    var st = orig ? orig.status : "new";
    var badge = { new: ["새 작품", ""], draft: ["임시저장", ""], public: ["공개 중", "public"], private: ["비공개", "private"] }[st];
    var buttons = [];
    if (st === "new" || st === "draft") buttons = [h("button", { class: "btn line", type: "button", text: "임시저장", onclick: function () { save("draft"); } }), h("button", { class: "btn", type: "button", text: "공개", onclick: function () { save("public"); } })];
    if (st === "public") buttons = [h("button", { class: "btn", type: "button", text: "저장 (공개 유지)", onclick: function () { save("public"); } }), h("button", { class: "btn line", type: "button", text: "비공개로 내리기", onclick: function () { save("private"); } })];
    if (st === "private") buttons = [h("button", { class: "btn line", type: "button", text: "저장 (비공개 유지)", onclick: function () { save("private"); } }), h("button", { class: "btn", type: "button", text: "재공개", onclick: function () { save("public"); } })];

    main.replaceChildren(
      h("div", { class: "h" },
        h("button", { class: "btn line small", type: "button", text: "← 목록", onclick: function () { if (guardLeave()) renderWorks(); } }),
        h("h2", { text: orig ? "작품 수정" : "새 작품" }), h("span", { class: "badge " + badge[1], text: badge[0] })),
      st === "public" ? h("p", { class: "url" }, "공개 주소: ", h("a", { href: "/portfolio/" + w.slug + "/", target: "_blank", rel: "noopener", text: SITE + "/portfolio/" + w.slug + "/" })) : null,
      h("div", { class: "card" },
        h("div", { class: "frow" }, h("label", { for: "w-title" }, "작품명 ", h("span", { class: "req", text: "*" })), title),
        h("div", { class: "frow" }, h("span", { class: "flabel" }, "사진 ", h("span", { class: "req", text: "*" })),
          h("p", { class: "note", text: "한 번 올리면 목록 썸네일과 상세 사진에 함께 쓰입니다. 끌어서(또는 ◀▶) 상세 사진 순서를 바꾸고, 목록에 보일 대표 사진을 고르세요." }),
          fileIn, drop, photosEl)),
      h("div", { class: "card" },
        h("h3", { text: "목록 썸네일" }), h("p", { class: "note", text: "목록에서 정사각형으로 보이는 모습입니다. ‘채우기’일 때는 사진을 끌어 초점을 맞출 수 있습니다." }),
        h("div", { class: "thumbset" }, thumbPv,
          h("div", { class: "radios", role: "radiogroup", "aria-label": "썸네일 방식" }, fitRadio("cover", "정사각형으로 채우기"), fitRadio("contain", "여백을 두고 전체 보기")))),
      h("div", { class: "card" },
        h("h3", { text: "선택 입력" }), h("p", { class: "note", text: "입력한 항목만 상세 페이지에 표시됩니다. 분야는 관리용이며 사이트에는 보이지 않습니다." }),
        h("div", { class: "frow" }, h("label", { for: "w-client", text: "고객사·기관명" }), clientIn,
          h("p", { class: "note", text: "목록에서 사진에 마우스를 올렸을 때 작품명 아래에 보입니다. 비워 두면 작품명과 화살표만 보입니다." })),
        h("div", { class: "frow" }, h("label", { for: "w-cat", text: "분야 (관리용)" }), catSel),
        h("div", { class: "frow" }, h("label", { for: "w-desc", text: "설명" }), desc),
        h("div", { class: "frow" }, h("span", { class: "flabel", text: "제작 사양" }), specsEl)),
      h("div", { class: "actions" }, buttons, h("span", { class: "sp" }), h("button", { class: "btn danger small", type: "button", text: orig ? "삭제" : "취소", onclick: remove })));
    drawPhotos(); drawThumb();
    window.scrollTo(0, 0);
    leaveGuard = function () { return !dirty || confirm("저장하지 않은 변경이 있습니다. 나가시겠어요?"); };
    leaveGuard.dirty = function () { return dirty; };
  }

  /* ------------------------------------------------------------ 시작 */
  function start() {
    app.replaceChildren(h("p", { class: "loading", text: "불러오는 중…" }));
    store.readText(CONTENT_PATH).then(function (t) {
      // 운영에서 보관함에 내용 파일이 없으면 멈춘다(빈 내용으로 저장해 사이트 목록이 지워지는 일을 막음)
      if (!t && !LOCAL_MODE) {
        app.replaceChildren(h("p", { class: "loading", text: "저장소에 내용 파일(_private/content.json)이 없어 관리자를 열 수 없습니다." }));
        return;
      }
      content = t ? JSON.parse(t) : emptyContent();
      renderShell();
    }).catch(function (e) { app.replaceChildren(h("p", { class: "loading", text: "내용을 불러오지 못했습니다: " + e.message })); });
  }
  store.session().then(function (ok) { if (ok) start(); else renderLogin(store.lastError || ""); }, function () { renderLogin(); });
})();
