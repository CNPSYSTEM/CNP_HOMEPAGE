/* C&P SYSTEM — 공개 사이트 스크립트 (대문↔목록 전환 · 목록 위치 기억 · 견적문의 폼) */
(function () {
  "use strict";
  var html = document.documentElement;
  html.classList.add("js");

  /* =========================================================
     0. 슬라이드 한 장에 내용 맞추기 (화면이 작으면 조금 줄여서 한 장에)
     ========================================================= */
  function fitSlides(els, avail) {
    els.forEach(function (el) {
      if (!el) return;
      el.classList.add("fit-slide");
      el.style.setProperty("--fit", "1");
      function natural() {            // 최소 높이를 풀었을 때의 실제 내용 높이
        var keep = el.style.minHeight;
        el.style.minHeight = "0px";
        var h = el.scrollHeight;
        el.style.minHeight = keep;
        return h;
      }
      var z = 1;
      for (var i = 0; i < 3; i++) {   // 여백은 줄지 않으므로 두세 번 나눠 맞춤
        var h = natural();
        if (h <= avail + 1) break;
        z = Math.max(0.72, z * (avail / h) * 0.995);
        el.style.setProperty("--fit", z.toFixed(3));
        if (z <= 0.72) break;
      }
    });
  }
  function onLayoutChange(fn) {
    var t;
    function run() { clearTimeout(t); t = setTimeout(fn, 60); }
    window.addEventListener("resize", run);
    window.addEventListener("load", fn);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
    fn();
  }

  /* =========================================================
     1. 대문 → 포트폴리오 목록 : 한 화면 단위 전환
     ========================================================= */
  var panel = document.getElementById("works");
  var hero = document.getElementById("hero");
  if (document.body.classList.contains("home") && panel && hero) initStage();

  function initStage() {
    var KEY = "cnp:home";
    var stage = "hero";
    var locked = false, lockMin = 0, lockMax = 0, lastWheel = 0;
    var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var DURATION = REDUCED ? 0 : 750;   // 대문 ↔ 첫 슬라이드
    var STEP = REDUCED ? 0 : 620;       // 슬라이드 ↔ 슬라이드
    var QUIET = 180; // 휠 입력이 이만큼(ms) 끊겨야 새 동작으로 봄 → 트랙패드 관성 차단
    var narrow = matchMedia("(max-width: 899px)");
    var anim = null, prevTop = 0;

    // 한 화면씩 넘어가는 구간(슬라이드). 마지막(포트폴리오)부터는 일반 스크롤
    //   휴대폰 : 씨앤피는 다릅니다 → 서비스 분야 → 포트폴리오
    //   컴퓨터 : (씨앤피는 다릅니다 + 서비스 분야) → 포트폴리오
    function slides() {
      var secs = panel.querySelectorAll(".home-intro .home-sec");
      // 컴퓨터·휴대폰 모두: 씨앤피는 다릅니다 → 서비스 분야 → 포트폴리오 (한 장씩)
      var list = [secs[0], secs[1], panel.querySelector(".home-works")];
      return list.filter(Boolean);
    }
    function headerH() { var h = document.querySelector(".site-header"); return h ? h.getBoundingClientRect().height : 0; }
    function points() {
      var pr = panel.getBoundingClientRect().top, hh = headerH();
      return slides().map(function (el) { return Math.max(0, Math.round(el.getBoundingClientRect().top - pr + panel.scrollTop - hh)); });
    }
    function lastPoint() { var p = points(); return p.length ? p[p.length - 1] : 0; }
    // 화면 크기에 맞춰 각 장의 내용을 한 장 안에 넣음(포트폴리오 장은 CSS 가 크기를 맞춤)
    function fitHome() {
      var all = [panel.querySelector(".home-intro")].concat(Array.prototype.slice.call(panel.querySelectorAll(".home-intro .home-sec")));
      all.forEach(function (el) { if (el) { el.classList.remove("fit-slide"); el.style.removeProperty("--fit"); } });
      var active = slides().filter(function (el) { return !el.classList.contains("home-works"); });
      fitSlides(active, panel.clientHeight - headerH());
    }
    onLayoutChange(fitHome);

    function setStage(next, instant) {
      if (instant) html.classList.add("no-anim");
      stage = next;
      html.dataset.stage = next;
      if (next === "hero") { panel.scrollTop = 0; prevTop = 0; }
      if (instant) { void panel.offsetHeight; html.classList.remove("no-anim"); }
    }
    function lock(ms) {
      var now = performance.now();
      locked = true; lockMin = now + ms + 60; lockMax = lockMin + 1800;
    }
    function enter() { if (stage === "list") return; setStage("list"); lock(DURATION); }
    function leave() { if (stage === "hero") return; setStage("hero"); lock(DURATION); }

    function animateTo(target, ms) {
      target = Math.max(0, Math.min(Math.round(target), panel.scrollHeight - panel.clientHeight));
      if (anim) cancelAnimationFrame(anim.raf);
      anim = null;
      lock(ms);
      if (!ms) { panel.scrollTop = target; prevTop = target; return; }
      var from = panel.scrollTop, t0 = performance.now();
      anim = { raf: 0 };
      function tick(now) {
        var k = Math.min(1, (now - t0) / ms);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        panel.scrollTop = from + (target - from) * e; prevTop = panel.scrollTop;
        if (k < 1) anim.raf = requestAnimationFrame(tick); else anim = null;
      }
      anim.raf = requestAnimationFrame(tick);
    }
    // dir: +1 다음 화면, -1 이전 화면. 처리했으면 true (false 면 일반 스크롤에 맡김)
    function step(dir) {
      var p = points(), last = p[p.length - 1] || 0, top = panel.scrollTop;
      var vh = panel.clientHeight - headerH();
      if (dir > 0) {
        if (top >= last - 1) return false;
        var next = p.filter(function (v) { return v > top + 1; })[0];
        // 화면보다 긴 슬라이드는 그 안에서 한 쪽씩 넘긴 뒤 다음으로
        var target = (next - top > vh + 8) ? Math.min(top + vh * 0.85, next - vh) : next;
        if (target <= top + 1) target = next;
        animateTo(target, STEP); return true;
      }
      if (top > last + 1) return false;
      if (top <= 0) { leave(); return true; }
      var before = p.filter(function (v) { return v < top - 1; });
      var prev = before.length ? before[before.length - 1] : 0;
      animateTo((top - prev > vh + 8) ? Math.max(top - vh * 0.85, prev) : prev, STEP);
      return true;
    }

    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return; // 확대/축소
      var now = performance.now();
      var gap = now - lastWheel;
      lastWheel = now;
      if (locked) {
        // 전환 중이거나, 전환 뒤에도 같은 휠/관성이 이어지는 동안은 모두 버림
        if (now < lockMin || (gap < QUIET && now < lockMax)) { e.preventDefault(); return; }
        locked = false;
      }
      if (stage === "hero") {
        e.preventDefault();
        if (e.deltaY > 0) enter();
        return;
      }
      var last = lastPoint(), top = panel.scrollTop;
      if (e.deltaY > 0) {
        if (top < last - 1) { e.preventDefault(); step(1); }
        return;                                   // 포트폴리오부터는 일반 스크롤
      }
      if (e.deltaY < 0 && top <= last + 1) {
        e.preventDefault();
        if (top > last - 1 && gap < QUIET) return;  // 목록을 올리던 관성으로는 앞 화면으로 넘어가지 않음
        step(-1);
      }
    }, { passive: false });

    // 포트폴리오를 위로 훑다가 관성으로 앞 슬라이드까지 밀려 들어가지 않게, 포트폴리오 맨 위에서 멈춤
    panel.addEventListener("scroll", function () {
      var top = panel.scrollTop;
      if (!anim && stage === "list") {
        var last = lastPoint();
        if (prevTop >= last - 1 && top < last - 1) { panel.scrollTop = last; top = last; lock(0); }
      }
      prevTop = top;
    });

    window.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var down = ["ArrowDown", "PageDown", " "].indexOf(e.key) > -1, up = ["ArrowUp", "PageUp"].indexOf(e.key) > -1;
      if (e.key === " " && t && /^(A|BUTTON)$/.test(t.tagName)) return;
      if (stage === "hero") {
        if (down || e.key === "End") { e.preventDefault(); enter(); }
        return;
      }
      if (locked && performance.now() < lockMin) { if (down || up) e.preventDefault(); return; }
      var last = lastPoint(), top = panel.scrollTop;
      if (down && top < last - 1) { e.preventDefault(); step(1); }
      else if ((up && top <= last + 1) || (e.key === "Home" && top <= 0)) { e.preventDefault(); step(-1); }
    });

    // 터치: 대문·슬라이드 구간에서는 한 번 쓸어 넘기면 한 화면씩 이동
    var ty = null, zone = "";
    window.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) { ty = null; return; }
      ty = e.touches[0].clientY;
      var top = panel.scrollTop, last = lastPoint();
      zone = stage === "hero" ? "hero" : (top < last - 1 ? "slides" : (top <= last + 1 ? "edge" : "free"));
    }, { passive: true });
    window.addEventListener("touchmove", function (e) {
      if (ty === null || !e.cancelable) return;
      if (zone === "hero" || zone === "slides") e.preventDefault();               // 화면 고정
      else if (zone === "edge" && e.touches[0].clientY - ty > 0) e.preventDefault(); // 포트폴리오 맨 위에서 아래로 당김
    }, { passive: false });
    window.addEventListener("touchend", function (e) {
      if (ty === null) return;
      var dy = e.changedTouches[0].clientY - ty;
      ty = null;
      if (locked && performance.now() < lockMin) return;
      if (zone === "hero") { if (dy < -36) enter(); }
      else if (zone === "slides") { if (dy < -36) step(1); else if (dy > 36) step(-1); }
      else if (zone === "edge") { if (dy > 36) step(-1); }
    }, { passive: true });

    // 클릭·키보드 포커스
    var next = hero.querySelector(".hero-next");
    if (next) next.addEventListener("click", function (e) { e.preventDefault(); enter(); panel.focus({ preventScroll: true }); });
    panel.setAttribute("tabindex", "-1");
    panel.addEventListener("focusin", function () { if (stage === "hero") enter(); });
    var logo = document.querySelector(".site-header .logo");
    if (logo) logo.addEventListener("click", function (e) { if (stage === "list") { e.preventDefault(); leave(); } });

    // 목록에서 보던 위치 기억 (작품 상세 → 뒤로)
    function save() {
      try { sessionStorage.setItem(KEY, JSON.stringify({ stage: stage, top: panel.scrollTop })); } catch (_) {}
    }
    function jump(top) { panel.scrollTop = top; prevTop = panel.scrollTop; }
    function restore() {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation")[0];
      var back = nav && nav.type === "back_forward";
      var saved = null;
      try { saved = JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (_) {}
      if (back && saved && saved.stage === "list") {
        setStage("list", true);
        var top = saved.top || 0;
        jump(top);
        // 사진이 늦게 뜨며 높이가 바뀌어도 위치 유지
        requestAnimationFrame(function () { jump(top); });
        window.addEventListener("load", function () { jump(top); }, { once: true });
      } else if (location.hash === "#works") {
        setStage("list", true);
      } else {
        setStage("hero", true);
      }
    }
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.addEventListener("pagehide", save);
    panel.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a")) save(); });
    restore();
  }

  /* =========================================================
     1-2. 포트폴리오 · 회사소개 페이지 : 한 화면씩 넘기는 슬라이드식 스크롤
     ========================================================= */
  // getPoints(): 멈출 위치(문서 맨 위에서부터의 거리, px) 목록을 돌려주는 함수
  function initPageSlides(getPoints) {
    var REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var STEP = REDUCED ? 0 : 620, QUIET = 180;
    var locked = false, lockMin = 0, lockMax = 0, lastWheel = 0, anim = null;
    var root = document.scrollingElement || document.documentElement;
    function headerH() { var h = document.querySelector(".site-header"); return h ? h.getBoundingClientRect().height : 0; }
    function maxTop() { return Math.max(0, root.scrollHeight - window.innerHeight); }
    function points() {
      var mx = maxTop(), seen = {}, out = [0];
      getPoints(headerH()).forEach(function (v) {
        v = Math.max(0, Math.min(Math.round(v), mx));
        if (v > 4 && !seen[v]) { seen[v] = 1; out.push(v); }
      });
      return out.sort(function (x, y) { return x - y; });
    }
    function lock(ms) { var now = performance.now(); locked = true; lockMin = now + ms + 60; lockMax = lockMin + 1800; }
    function animateTo(target, ms) {
      target = Math.max(0, Math.min(Math.round(target), maxTop()));
      if (anim) cancelAnimationFrame(anim.raf);
      anim = null;
      lock(ms);
      if (!ms) { window.scrollTo(0, target); return; }
      var from = window.scrollY, t0 = performance.now();
      anim = { raf: 0 };
      function tick(now) {
        var k = Math.min(1, (now - t0) / ms);
        var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        window.scrollTo(0, from + (target - from) * e);
        if (k < 1) anim.raf = requestAnimationFrame(tick); else anim = null;
      }
      anim.raf = requestAnimationFrame(tick);
    }
    function step(dir) {
      var p = points(), top = window.scrollY, vh = window.innerHeight - headerH(), mx = maxTop();
      if (dir > 0) {
        if (top >= mx - 1) return false;
        var next = p.filter(function (v) { return v > top + 1; })[0];
        if (next === undefined) next = mx;                       // 마지막 구간: 남은 만큼
        // 화면보다 훨씬 긴 구간만 그 안에서 한 쪽씩 넘기고, 조금 넘치는 정도면 바로 다음으로
        var target = (next - top > vh * 1.35) ? Math.min(top + vh * 0.85, next - vh) : next;
        if (target <= top + 1) target = next;
        animateTo(target, STEP); return true;
      }
      if (top <= 0) return false;
      var before = p.filter(function (v) { return v < top - 1; });
      var prev = before.length ? before[before.length - 1] : 0;
      animateTo((top - prev > vh * 1.35) ? Math.max(top - vh * 0.85, prev) : prev, STEP);
      return true;
    }
    window.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return;
      var now = performance.now(), gap = now - lastWheel;
      lastWheel = now;
      if (locked) {
        if (now < lockMin || (gap < QUIET && now < lockMax)) { e.preventDefault(); return; }
        locked = false;
      }
      if (!e.deltaY) return;
      e.preventDefault();
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
    window.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      var t = e.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === " " && t && /^(A|BUTTON)$/.test(t.tagName)) return;
      var down = ["ArrowDown", "PageDown", " "].indexOf(e.key) > -1, up = ["ArrowUp", "PageUp"].indexOf(e.key) > -1;
      if (!down && !up) return;
      e.preventDefault();
      if (locked && performance.now() < lockMin) return;
      step(down ? 1 : -1);
    });
    var ty = null;
    window.addEventListener("touchstart", function (e) { ty = e.touches.length === 1 ? e.touches[0].clientY : null; }, { passive: true });
    window.addEventListener("touchmove", function (e) { if (ty !== null && e.touches.length === 1 && e.cancelable) e.preventDefault(); }, { passive: false });
    window.addEventListener("touchend", function (e) {
      if (ty === null) return;
      var dy = e.changedTouches[0].clientY - ty;
      ty = null;
      if (locked && performance.now() < lockMin) return;
      if (dy < -36) step(1); else if (dy > 36) step(-1);
    }, { passive: true });
  }

  // 포트폴리오 페이지: 화면에 들어가는 줄 수만큼씩 넘김
  if (document.body.classList.contains("page-portfolio")) {
    initPageSlides(function (hh) {
      var grid = document.querySelector(".grid");
      if (!grid) return [];
      var tops = [], seen = {};
      Array.prototype.forEach.call(grid.children, function (li) {
        var r = li.getBoundingClientRect();
        if (!r.height) return;
        var t = Math.round(r.top + window.scrollY);
        if (!seen[t]) { seen[t] = 1; tops.push({ top: t, h: r.height }); }
      });
      if (tops.length < 2) return [];
      var rowStep = tops[1].top - tops[0].top;                         // 한 줄 높이(간격 포함)
      var gap = Math.max(0, rowStep - tops[0].h);
      var per = grid.classList.contains("fit4") ? 4                            // 한 화면 = 4줄
        : Math.max(1, Math.floor((window.innerHeight - hh) / rowStep));
      var out = [];
      for (var i = per; i < tops.length; i += per) out.push(tops[i].top - hh - gap);
      return out;
    });
  }
  // 회사소개 페이지: 소개글 → 회사개요 → 강점 → 서비스 분야 → 마무리
  if (document.body.classList.contains("page-about")) {
    var aboutSlides = function () {
      return Array.prototype.slice.call(document.querySelectorAll(".about .about-intro, .about .doc-section, .about .about-closing"));
    };
    onLayoutChange(function () {
      var h = document.querySelector(".site-header");
      fitSlides(aboutSlides(), window.innerHeight - (h ? h.getBoundingClientRect().height : 0));
    });
    initPageSlides(function (hh) {
      return aboutSlides().slice(1).map(function (el) { return el.getBoundingClientRect().top + window.scrollY - hh; });
    });
  }

  /* =========================================================
     2. 작품 상세 : "목록" 을 누르면 보던 위치로 돌아가기
     ========================================================= */
  document.querySelectorAll("a[data-back]").forEach(function (a) {
    a.addEventListener("click", function (e) {
      var ref = document.referrer;
      if (!ref || history.length < 2) return;
      try {
        var u = new URL(ref);
        if (u.origin === location.origin && (u.pathname === "/" || u.pathname === "/portfolio/" || u.pathname === "/index.html")) {
          e.preventDefault(); history.back();
        }
      } catch (_) {}
    });
  });

  /* =========================================================
     3. 견적문의 폼
     ========================================================= */
  var form = document.getElementById("quote-form");
  if (form) initQuote();

  function initQuote() {
    var cfg = window.CNP_CONFIG || {};
    var errBox = document.getElementById("quote-error");
    var done = document.getElementById("quote-done");
    var submit = document.getElementById("quote-submit");
    var fileInput = document.getElementById("q-files");
    var fileList = document.getElementById("q-files-list");
    var refBox = document.getElementById("work-ref");
    var refLink = document.getElementById("work-ref-link");
    var work = null;

    // 작품 상세에서 넘어온 경우: 참고 작품 자동 연결 (공개 작품 목록에 있는 것만)
    var slug = new URLSearchParams(location.search).get("work");
    if (slug && /^[a-z0-9-]{1,60}$/.test(slug)) {
      fetch("/data/site.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) {
        var w = (d.works || []).filter(function (x) { return x.slug === slug; })[0];
        if (!w) return;
        work = { slug: w.slug, title: w.title };
        refLink.textContent = w.title;
        refLink.href = "/portfolio/" + w.slug + "/";
        refBox.hidden = false;
      }).catch(function () {});
    }
    document.getElementById("work-ref-remove").addEventListener("click", function () {
      work = null; refBox.hidden = true;
      history.replaceState(null, "", location.pathname);
    });

    function fmtSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + "MB" : Math.max(1, Math.round(n / 1024)) + "KB"; }
    function checkFiles() {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileList.innerHTML = "";
      var total = 0, bad = null;
      files.forEach(function (f) {
        total += f.size;
        var ext = (f.name.split(".").pop() || "").toLowerCase();
        if ((cfg.allowedExt || []).indexOf(ext) < 0) bad = "첨부할 수 없는 형식입니다: " + f.name;
        var li = document.createElement("li");
        li.textContent = f.name + " (" + fmtSize(f.size) + ")";
        fileList.appendChild(li);
      });
      if (!bad && files.length > (cfg.maxFiles || 5)) bad = "파일은 최대 " + (cfg.maxFiles || 5) + "개까지 첨부할 수 있습니다.";
      if (!bad && total > (cfg.maxTotalBytes || 15728640)) bad = "첨부 파일 합계가 15MB를 넘습니다. (현재 " + fmtSize(total) + ")";
      return bad;
    }
    fileInput.addEventListener("change", function () { var bad = checkFiles(); setFieldMsg(fileInput, bad); });

    function setFieldMsg(input, msg) {
      var field = input.closest(".field");
      var old = field.querySelector(".field-msg");
      if (old) old.remove();
      field.classList.toggle("is-invalid", !!msg);
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg) {
        var p = document.createElement("p");
        p.className = "field-msg"; p.textContent = msg;
        field.appendChild(p);
      }
    }
    function validate() {
      var first = null;
      var rules = [
        ["q-name", "담당자명을 입력해 주세요."],
        ["q-org", "회사·기관명을 입력해 주세요. 개인이면 '개인'이라고 적어 주세요."],
        ["q-phone", "연락처(전화번호)를 입력해 주세요."],
        ["q-email", "회신받을 이메일을 입력해 주세요."],
        ["q-item", "제작 품목을 입력해 주세요."],
        ["q-qty", "예상 수량을 입력해 주세요."]
      ];
      rules.forEach(function (r) {
        var el = document.getElementById(r[0]);
        var v = el.value.trim(), msg = "";
        if (!v) msg = r[1];
        else if (r[0] === "q-email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) msg = "이메일 주소 형식을 확인해 주세요.";
        else if (r[0] === "q-phone" && v.replace(/\D/g, "").length < 8) msg = "전화번호를 확인해 주세요.";
        setFieldMsg(el, msg);
        if (msg && !first) first = el;
      });
      var bad = checkFiles();
      setFieldMsg(fileInput, bad);
      if (bad && !first) first = fileInput;
      if (first) first.focus();
      return !first;
    }
    function readFile(f) {
      return new Promise(function (resolve, reject) {
        var fr = new FileReader();
        fr.onload = function () { resolve({ name: f.name, type: f.type || "application/octet-stream", b64: String(fr.result).split(",")[1] || "" }); };
        fr.onerror = function () { reject(new Error("파일을 읽지 못했습니다: " + f.name)); };
        fr.readAsDataURL(f);
      });
    }
    function showError(msg) {
      errBox.textContent = msg; errBox.hidden = false;
      errBox.scrollIntoView({ block: "center", behavior: "smooth" });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errBox.hidden = true;
      if (!validate()) return;
      if (!cfg.quoteEndpoint) {
        showError("메일 발송 설정이 아직 연결되지 않아 접수할 수 없습니다. 전화(041-557-3900)로 문의해 주세요. 입력하신 내용은 그대로 남아 있습니다.");
        return;
      }
      var v = function (id) { return document.getElementById(id).value.trim(); };
      submit.disabled = true; submit.textContent = "보내는 중…";
      Promise.all(Array.prototype.map.call(fileInput.files || [], readFile)).then(function (files) {
        var payload = {
          name: v("q-name"), phone: v("q-phone"), email: v("q-email"), item: v("q-item"), qty: v("q-qty"),
          org: v("q-org"), due: v("q-due"), notes: v("q-notes"),
          website: form.elements.website.value,
          workSlug: work ? work.slug : "", workTitle: work ? work.title : "",
          files: files
        };
        // text/plain 으로 보내 사전요청(preflight) 없이 전송 (Apps Script 호환)
        return fetch(cfg.quoteEndpoint, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      }).then(function (r) {
        return r.text().then(function (t) {
          var d = null; try { d = JSON.parse(t); } catch (_) {}
          if (!r.ok || !d || d.ok !== true) throw new Error((d && d.message) || "");
        });
      }).then(function () {
        // 실제 발송 성공 응답을 받았을 때만 접수 완료 표시
        form.hidden = true; done.hidden = false; done.focus();
        window.scrollTo(0, 0);
      }).catch(function (err) {
        showError((err && err.message ? err.message + " " : "전송하지 못했습니다. ") + "입력하신 내용은 그대로 남아 있으니 잠시 뒤 다시 보내기를 눌러 주세요.");
      }).then(function () {
        submit.disabled = false; submit.textContent = form.hidden ? "견적 요청 보내기" : (errBox.hidden ? "견적 요청 보내기" : "다시 보내기");
      });
    });
  }
})();
