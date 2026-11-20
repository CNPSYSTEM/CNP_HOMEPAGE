# -*- coding: utf-8 -*-
"""공개 페이지 틀(HTML)을 한 번에 만들어 주는 도구.

머리글(메뉴)·바닥글을 한 곳에서 관리하려고 씁니다.
메뉴나 바닥글 정보를 바꿀 때만 다시 실행합니다:  python _tools/scaffold.py
작품 목록·대문 사진 부분(<!--WORKS-->, <!--HERO--> 표시 사이)은 관리자 화면이 채우므로
이미 있는 파일의 그 부분은 그대로 보존합니다.
"""
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://cnpsystem.kr"
NAME = "씨앤피시스템"

# 검색 등록(네이버 서치어드바이저 · 구글 서치콘솔) 소유확인 코드. 새 코드를 받으면 한 줄씩 추가합니다.
SITE_VERIFY = [
    '<meta name="naver-site-verification" content="80fee4017d0725913e32d8c14e9f46170c089cc9" />',
    '<meta name="google-site-verification" content="y0vHB-rFDtwpyYZ2FzXnPxqz-KvU6QkRSHzd2wvu_Qo" />',
]

MENU = [("/about/", "회사소개"), ("/portfolio/", "포트폴리오"),
        ("/contact/", "견적문의"), ("/guide/", "안내")]


def head(title, desc, path, og_image=SITE + "/assets/og-logo.png", noindex=False, extra=""):
    robots = '\n  <meta name="robots" content="noindex" />' if noindex else ""
    canonical = "" if noindex else f'\n  <link rel="canonical" href="{SITE}{path}" />'
    # 검색엔진 소유확인 코드: 홈 화면에만 넣습니다
    verify = "".join("\n  " + v for v in SITE_VERIFY) if path == "/" else ""
    return f"""<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>{title}</title>
  <meta name="description" content="{desc}" />{robots}{canonical}{verify}
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="{NAME}" />
  <meta property="og:title" content="{title}" />
  <meta property="og:description" content="{desc}" />
  <meta property="og:url" content="{SITE}{path}" />
  <meta property="og:image" content="{og_image}" />
  <meta property="og:locale" content="ko_KR" />
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
{extra}  <link rel="stylesheet" href="/css/site.css" />
</head>"""


def header(current):
    items = "\n".join(
        f'        <a href="{href}"{" aria-current=\"page\"" if href == current else ""}>{label}</a>'
        for href, label in MENU)
    return f"""  <a class="skip-link" href="#main">본문 바로가기</a>
  <header class="site-header">
    <a class="logo" href="/" aria-label="C&amp;P SYSTEM 씨앤피시스템 홈"><img class="logo-img logo-color" src="/assets/logo-cnp.svg" alt="" width="199" height="34" /><img class="logo-img logo-white" src="/assets/logo-cnp-white.svg" alt="" width="199" height="34" /></a>
    <nav class="site-nav" aria-label="주요 메뉴">
{items}
    </nav>
  </header>"""


FOOTER = """  <footer class="site-footer">
    <p class="footer-logo">C&amp;P SYSTEM</p>
    <ul class="footer-meta">
      <li>천안시 서북구 백석로 10 씨앤피시스템</li>
      <li>T. <a href="tel:0415573900">041-557-3900</a> / <a href="tel:0415573920">041-557-3920</a></li>
      <li>E. cnp3900@naver.com</li>
      <li>평일 09:00~18:30 · 주말·공휴일 휴무</li>
      <li>사업자등록번호 429-23-01567</li>
    </ul>
    <p class="footer-copy">&copy; C&amp;P SYSTEM. All rights reserved.</p>
  </footer>"""

SCRIPTS = """  <script src="/js/config.js"></script>
  <script src="/js/site.js"></script>"""

ORG_LD = """  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"LocalBusiness",
   "name":"씨앤피시스템 (C&P SYSTEM)","alternateName":["씨앤피시스템","C&P SYSTEM"],
   "url":"https://cnpsystem.kr/",
   "logo":"https://cnpsystem.kr/assets/og-logo.png","image":"https://cnpsystem.kr/assets/og-logo.png",
   "description":"천안 디자인·인쇄 씨앤피시스템. 리플렛·브로슈어·포스터 디자인, 교재·책자 편집디자인, 로고·BI, 패키지·라벨, 주문형 인쇄, 제본, 현수막·배너 대형출력.",
   "telephone":"+82-41-557-3900","email":"cnp3900@naver.com",
   "address":{"@type":"PostalAddress","addressCountry":"KR","addressRegion":"충청남도","addressLocality":"천안시 서북구","streetAddress":"백석로 10"},
   "openingHoursSpecification":[{"@type":"OpeningHoursSpecification","dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],"opens":"09:00","closes":"18:30"}]}
  </script>"""

HOME_TITLE = "천안 디자인 인쇄소 씨앤피시스템"
HOME_DESC = "천안 디자인·인쇄 씨앤피시스템 | 리플렛·브로슈어·포스터 디자인 | 교재·책자 편집디자인 | 로고·BI | 패키지·라벨 | 주문형 인쇄 | 제본 | 현수막·배너 대형출력"

PAGES = {}

PAGES["index.html"] = f"""{head(HOME_TITLE, HOME_DESC, "/")}
<body class="home">
{header("/")}
  <main id="main">
    <section class="hero" id="hero" aria-label="대문">
      <!--HERO:START--><!--HERO:END-->
      <div class="hero-text">
        <h1 class="hero-big">우리가 디자인하고,<br />우리가 인쇄합니다.</h1>
        <p class="hero-desc">씨앤피시스템의 디자인과 인쇄로 귀사의 브랜드를 업그레이드하세요.</p>
        <p class="hero-en" lang="en">Upgrade your brand with C&amp;P System's design and printing.</p>
      </div>
      <a class="hero-next" href="#works" aria-label="포트폴리오 보기"><span aria-hidden="true"></span></a>
    </section>

    <section class="panel" id="works" aria-label="소개와 포트폴리오">
      <div class="home-intro">
        <section class="home-sec" aria-labelledby="home-strengths">
          <h2 class="home-h" id="home-strengths">씨앤피는 다릅니다</h2>
          <div class="about-cards">
            <div class="about-card">
              <h3>Creative · 쓰임을 생각하는 디자인</h3>
              <p>리플렛은 접힌 표지에서 한 면씩 펼쳐 읽고, 포스터는 걸음을 옮기면서도 한눈에 봅니다. 같은 행사라도 인쇄물의 쓰임에 따라 제목의 크기와 정보의 순서를 다르게 잡습니다.</p>
            </div>
            <div class="about-card">
              <h3>Print · 필요한 만큼 만드는 주문형 인쇄</h3>
              <p>한 장의 포스터부터 여러 권의 교재까지, 용도와 수량에 맞춰 인쇄합니다. 필기할 교재에는 어떤 종이가 어울리는지, 자주 펼쳐 볼 책자는 어떻게 제본하면 좋을지 함께 살핍니다.</p>
            </div>
            <div class="about-card">
              <h3>System · 디자인부터 제본까지 한 팀</h3>
              <p>원고를 받아 편집한 팀이 인쇄와 제본까지 맡습니다. 제작 중에 페이지 수가 바뀌거나 용지를 조정할 때도 한곳에서 상의할 수 있습니다.</p>
            </div>
          </div>
        </section>

        <section class="home-sec" aria-labelledby="home-services">
          <h2 class="home-h" id="home-services">서비스 분야</h2>
          <p class="about-note">디자인부터 제작까지 함께 맡기셔도, 디자인이나 인쇄만 의뢰하셔도 됩니다.</p>
          <table class="about-table about-table-services">
            <tbody>
              <tr><th scope="row">브랜드 디자인</th><td>로고, BI, 명함</td></tr>
              <tr><th scope="row">홍보물 디자인</th><td>브로슈어, 리플렛, 포스터, 배너, 제안서</td></tr>
              <tr><th scope="row">편집 디자인</th><td>교재, 책자, 보고서, 카탈로그</td></tr>
              <tr><th scope="row">패키지 디자인</th><td>패키지, 제품 라벨</td></tr>
              <tr><th scope="row">주문형 인쇄·제본</th><td>필요한 수량만큼 인쇄하고 용도에 맞게 제본</td></tr>
              <tr><th scope="row">대형출력</th><td>현수막, 배너, 대형 포스터</td></tr>
            </tbody>
          </table>
        </section>
      </div>

      <section class="home-works" aria-labelledby="home-portfolio">
        <h2 class="home-h home-works-h" id="home-portfolio">포트폴리오</h2>
        <!-- 홈에는 최근 순서로 4줄(PC 16개 · 모바일 8개)까지만 보이고, 전체는 포트폴리오 페이지에서 봅니다 -->
        <ul class="grid">
<!--WORKS:START--><!--WORKS:END-->
        </ul>
        <p class="home-more"><a class="btn" href="/portfolio/">더 많은 포트폴리오 보기</a></p>
      </section>
{FOOTER}
    </section>
  </main>
{ORG_LD}
{SCRIPTS}
</body>
</html>
"""

PAGES["portfolio/index.html"] = f"""{head("포트폴리오 | 씨앤피시스템", "씨앤피시스템이 디자인하고 인쇄·제작한 리플렛, 책자, 포스터, 현수막 등 제작 사례를 사진으로 보실 수 있습니다.", "/portfolio/")}
<body class="page page-portfolio">
{header("/portfolio/")}
  <main id="main">
    <h1 class="sr-only">포트폴리오</h1>
    <ul class="grid">
<!--WORKS:START--><!--WORKS:END-->
    </ul>
  </main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""

PAGES["about/index.html"] = f"""{head("회사소개 | 씨앤피시스템", "1988년 창원에서 시작해 천안에서 이어온 씨앤피시스템. 기획·디자인부터 주문형 인쇄(POD), 제본, 대형출력까지 맡아 진행합니다.", "/about/")}
<body class="page page-about">
{header("/about/")}
  <main id="main" class="doc doc-wide about">
    <h1 class="doc-title">회사소개</h1>

    <section class="about-intro">
      <p class="about-eyebrow" lang="en">SINCE 1988 · CREATIVE &amp; PRINT SYSTEM</p>
      <p class="about-lead">Copy에서 Creative로,<br />
      축적된 인쇄의 경험에 디자인의 시선을 더하다.</p>
      <div class="about-body">
        <p>1988년 경남 창원의 ‘경남측기사’에서 시작된 씨앤피시스템은<br />
        2005년 충남 천안으로 자리를 옮겨, 40년 가까이 인쇄의 길을 걸어왔습니다.</p>
        <p>오랫동안 C&amp;P는 Copy &amp; Print였습니다.<br />
        2021년, 박물관과 미술관에서 전시를 기획해 온 딸이 가업을 이어받으며<br />
        그 이름에 새로운 의미를 더했습니다.</p>
        <p>전시를 기획하며 얻은 시선은 씨앤피시스템의 디자인 철학으로 이어집니다.<br />
        전시가 관람객을 향하듯,<br />
        인쇄물 역시 그것을 마주할 사람을 향해야 합니다.</p>
        <p>무엇을 만들 것인가보다, 무엇을 전할 것인가.<br class="keep" />
        이 질문에서 우리의 디자인은 시작됩니다.</p>
        <p>이제 C&amp;P의 C는 <strong class="ci-orange">Creative</strong>입니다.</p>
        <p>씨앤피시스템은 기획과 디자인, 인쇄와 제작을 아우릅니다.<br />
        각 분야의 전문 파트너와 함께 목적에 맞는 방식으로, 필요한 만큼 완성합니다.</p>
      </div>
    </section>

    <section class="doc-section" aria-labelledby="about-overview">
      <h2 id="about-overview">회사개요</h2>
      <table class="about-table">
        <tbody>
          <tr><th scope="row">회사명</th><td>씨앤피시스템 (C&amp;P SYSTEM)</td></tr>
          <tr><th scope="row">연혁</th><td>
            <ul class="about-history">
              <li>1988년 창원 경남측기사에서 시작</li>
              <li>2005년 천안 이전, 씨앤피시스템 사명 변경</li>
              <li>2021년 기획 디자인분야로 확장</li>
            </ul></td></tr>
          <tr><th scope="row">사업분야</th><td>기획·디자인, 인쇄(POD), 제본, 대형출력 등</td></tr>
          <tr><th scope="row">기업구분</th><td>
            <ul class="about-tags">
              <li>중소기업</li>
              <li>여성기업</li>
              <li>창업기업</li>
              <li>산업디자인전문회사</li>
              <li>출판사등록</li>
              <li>직접생산증명[신청중]</li>
            </ul></td></tr>
          <tr><th scope="row">소재지</th><td>충청남도 천안시 서북구 백석로 10, 101호</td></tr>
          <tr><th scope="row">연락처</th><td>[대표번호] <a href="tel:0415573900">041-557-3900</a> <span class="nb">· <a href="tel:0415573920">041-557-3920</a></span></td></tr>
          <tr><th scope="row">이메일</th><td><a href="mailto:cnp3900@naver.com">cnp3900@naver.com</a></td></tr>
          <tr><th scope="row">운영시간</th><td>평일 09:00~18:30 · 주말 및 공휴일 휴무</td></tr>
        </tbody>
      </table>
    </section>

    <section class="doc-section" aria-labelledby="about-strengths">
      <h2 id="about-strengths">씨앤피는 다릅니다</h2>
      <div class="about-cards">
        <div class="about-card">
          <h3>Creative · 쓰임을 생각하는 디자인</h3>
          <p>리플렛은 접힌 표지에서 한 면씩 펼쳐 읽고, 포스터는 걸음을 옮기면서도 한눈에 봅니다. 같은 행사라도 인쇄물의 쓰임에 따라 제목의 크기와 정보의 순서를 다르게 잡습니다.</p>
        </div>
        <div class="about-card">
          <h3>Print · 필요한 만큼 만드는 주문형 인쇄</h3>
          <p>한 장의 포스터부터 여러 권의 교재까지, 용도와 수량에 맞춰 인쇄합니다. 필기할 교재에는 어떤 종이가 어울리는지, 자주 펼쳐 볼 책자는 어떻게 제본하면 좋을지 함께 살핍니다.</p>
        </div>
        <div class="about-card">
          <h3>System · 디자인부터 제본까지 한 팀</h3>
          <p>원고를 받아 편집한 팀이 인쇄와 제본까지 맡습니다. 제작 중에 페이지 수가 바뀌거나 용지를 조정할 때도 한곳에서 상의할 수 있습니다.</p>
        </div>
      </div>
    </section>

    <section class="doc-section" aria-labelledby="about-services">
      <h2 id="about-services">서비스 분야</h2>
      <p class="about-note">디자인부터 제작까지 함께 맡기셔도, 디자인이나 인쇄만 의뢰하셔도 됩니다.</p>
      <table class="about-table about-table-services">
        <tbody>
          <tr><th scope="row">브랜드 디자인</th><td>로고, BI, 명함</td></tr>
          <tr><th scope="row">홍보물 디자인</th><td>브로슈어, 리플렛, 포스터, 배너, 제안서</td></tr>
          <tr><th scope="row">편집 디자인</th><td>교재, 책자, 보고서, 카탈로그</td></tr>
          <tr><th scope="row">패키지 디자인</th><td>패키지, 제품 라벨</td></tr>
          <tr><th scope="row">주문형 인쇄·제본</th><td>필요한 수량만큼 인쇄하고 용도에 맞게 제본</td></tr>
          <tr><th scope="row">대형출력</th><td>현수막, 배너, 대형 포스터</td></tr>
        </tbody>
      </table>
    </section>

    <section class="about-closing">
      <p class="about-lead">생각은 디자인으로, 디자인은 정확한 인쇄로.</p>
      <p class="about-closing-text">만들고 싶은 인쇄물과 필요한 수량을 알려주세요. 용지나 제본 방식은 함께 정해도 좋습니다.</p>
      <p class="about-contact"><a class="btn" href="/contact/">견적 문의</a><span class="about-contact-links"><span class="sep sep-first" aria-hidden="true">·</span><a href="tel:0415573900">041-557-3900</a><span class="sep" aria-hidden="true">·</span><a href="mailto:cnp3900@naver.com">cnp3900@naver.com</a></span></p>
    </section>
  </main>
{FOOTER}
{ORG_LD}
{SCRIPTS}
</body>
</html>
"""

PAGES["guide/index.html"] = f"""{head("안내 | 씨앤피시스템", "견적에 필요한 내용, 보낼 파일, 문의 후 진행 순서와 방문 수령 안내입니다. 제작 품목과 예상 수량을 알려주시면 이메일로 견적을 보내드립니다.", "/guide/")}
<body class="page page-guide">
{header("/guide/")}
  <main id="main" class="doc">
    <h1 class="doc-title">안내</h1>

    <section class="doc-section qa">
      <h2>어떤 내용을 보내면 견적을 받을 수 있나요?</h2>
      <p>제작 품목과 예상 수량을 알려주세요. 크기와 희망 수령일이 정해졌다면 함께 적어주세요. 용지나 제본 방식을 고민 중이라면 어디에 쓸 인쇄물인지 적어주셔도 좋습니다.</p>
    </section>

    <section class="doc-section qa">
      <h2>어떤 파일을 보내면 되나요?</h2>
      <p>인쇄할 PDF가 있다면 첨부해 주세요. 디자인부터 의뢰하실 때는 작성한 원고나 참고하고 싶은 제작물 사진을 보내주시면 됩니다. 견적문의에는 파일을 최대 5개, 합계 15MB까지 첨부할 수 있습니다.</p>
    </section>

    <section class="doc-section qa">
      <h2>문의한 뒤에는 어떻게 진행되나요?</h2>
      <p>제작 내용을 확인한 뒤 입력하신 이메일로 견적이나 추가 질문을 보내드립니다. 견적과 제작 사양이 정해지면 제작 일정과 수령 방법을 안내드립니다.</p>
    </section>

    <section class="doc-section qa">
      <h2>방문 수령은 어디서 하나요?</h2>
      <p>천안시 서북구 백석로 10, 씨앤피시스템에서 수령하실 수 있습니다. 운영시간은 평일 오전 9시부터 오후 6시 30분까지이며, 주말과 공휴일은 쉽니다.</p>
    </section>

    <p class="doc-cta"><a class="btn" href="/contact/">견적문의</a></p>
  </main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""

PAGES["contact/index.html"] = f"""{head("견적문의 | 씨앤피시스템", "인쇄·디자인 제작 견적을 문의해 주세요. 제작 품목과 수량을 보내 주시면 확인 후 이메일로 견적을 안내해 드립니다.", "/contact/")}
<body class="page">
{header("/contact/")}
  <main id="main" class="doc doc-wide">
    <h1 class="doc-title">견적문의</h1>

    <div class="contact-intro">
      <p class="about-lead">생각은 디자인으로, 디자인은 정확한 인쇄로.</p>
      <p class="contact-intro-text">만들고 싶은 인쇄물과 필요한 수량을 알려주세요. 용지나 제본 방식은 함께 정해도 좋습니다.</p>
    </div>

    <div id="quote-done" class="done" role="status" tabindex="-1" hidden>
      <p>견적 요청이 접수되었습니다. 제작 내용을 확인한 뒤 입력하신 이메일로 견적 또는 추가 확인 사항을 보내드리겠습니다.</p>
      <p><a class="btn btn-line" href="/portfolio/">포트폴리오 보기</a></p>
    </div>

    <form id="quote-form" class="form" novalidate>
      <p class="form-lead">아래 내용을 보내 주시면 확인 후 입력하신 이메일로 견적을 보내드립니다. <span class="req-mark">*</span> 표시는 필수 항목입니다.</p>

      <div id="work-ref" class="work-ref" hidden>
        <span class="work-ref-label">참고 작품</span>
        <a id="work-ref-link" href="#" target="_blank" rel="noopener"></a>
        <button type="button" id="work-ref-remove" class="link-btn">참고 작품 빼기</button>
      </div>

      <div class="form-grid">
        <div class="field">
          <label for="q-name">담당자명 <span class="req-mark">*</span></label>
          <input id="q-name" name="name" type="text" autocomplete="name" required maxlength="40" />
        </div>
        <div class="field">
          <label for="q-org">회사·기관명 <span class="req-mark">*</span><span class="label-hint">(개인이면 개인 표기)</span></label>
          <input id="q-org" name="org" type="text" autocomplete="organization" required maxlength="60" />
        </div>
        <div class="field">
          <label for="q-phone">연락처(전화번호) <span class="req-mark">*</span></label>
          <input id="q-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" required maxlength="30" placeholder="010-0000-0000" />
        </div>
        <div class="field">
          <label for="q-email">회신받을 이메일 <span class="req-mark">*</span></label>
          <input id="q-email" name="email" type="email" autocomplete="email" required maxlength="100" />
        </div>
        <div class="field">
          <label for="q-item">제작 품목 <span class="req-mark">*</span></label>
          <input id="q-item" name="item" type="text" required maxlength="60" placeholder="예: 스티커, 리플렛, 책자, 현수막" />
        </div>
        <div class="field">
          <label for="q-qty">예상 수량 <span class="req-mark">*</span></label>
          <input id="q-qty" name="qty" type="text" required maxlength="40" placeholder="예: 500장" />
        </div>
        <div class="field">
          <label for="q-due">희망 수령일</label>
          <input id="q-due" name="due" type="date" />
        </div>
        <div class="field full">
          <label for="q-notes">규격·용지 등 요청사항</label>
          <textarea id="q-notes" name="notes" rows="5" maxlength="3000"></textarea>
        </div>
        <div class="field full">
          <label for="q-files">참고 파일</label>
          <input id="q-files" name="files" type="file" multiple
                 accept=".pdf,.ai,.psd,.jpg,.jpeg,.png,.zip,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.ppt,.pptx" aria-describedby="q-files-help" />
          <p id="q-files-help" class="help">첨부 가능: PDF, AI, PSD, JPG, PNG, ZIP, HWP, 워드, 엑셀, 파워포인트 · 최대 5개, 합계 15MB까지</p>
          <ul id="q-files-list" class="file-list"></ul>
        </div>
      </div>
      <div class="hp" aria-hidden="true">
        <label>이 칸은 비워 두세요 <input name="website" type="text" tabindex="-1" autocomplete="off" /></label>
      </div>

      <p id="quote-error" class="form-error" role="alert" hidden></p>
      <button type="submit" class="btn" id="quote-submit">견적 요청 보내기</button>
    </form>
  </main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""

PAGES["404.html"] = f"""{head("페이지를 찾을 수 없습니다 | 씨앤피시스템", "요청하신 페이지를 찾을 수 없습니다.", "/404.html", noindex=True)}
<body class="page">
{header("")}
  <main id="main" class="doc">
    <h1 class="doc-title">페이지를 찾을 수 없습니다</h1>
    <p>주소가 바뀌었거나 공개가 끝난 페이지입니다.</p>
    <p class="doc-cta"><a class="btn" href="/portfolio/">포트폴리오 보기</a></p>
  </main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""

# 작품 상세 틀 — 관리자 화면이 {{...}} 자리를 채워 portfolio/<주소>/index.html 로 만듭니다.
WORK_HEAD = head("{{TITLE}} | 포트폴리오 | 씨앤피시스템", "{{DESC_META}}", "/portfolio/{{SLUG}}/", og_image="{{OG_IMAGE}}")
PAGES["_templates/work.html"] = f"""{WORK_HEAD}
<body class="page page-work">
{header("/portfolio/")}
  <main id="main" class="work">
    <p class="work-back"><a href="/portfolio/" data-back>← 목록</a></p>
    <h1 class="work-title">{{{{TITLE}}}}</h1>
    <div class="work-photos">
{{{{PHOTOS}}}}
    </div>
{{{{DESC_BLOCK}}}}{{{{SPECS_BLOCK}}}}
    <p class="work-cta"><a class="btn" href="/contact/?work={{{{SLUG}}}}">이런 제작물 견적문의</a></p>
    <p class="work-back work-back-bottom"><a href="/portfolio/" data-back>← 목록으로</a></p>
  </main>
{FOOTER}
{SCRIPTS}
</body>
</html>
"""

MARK = re.compile(r"<!--(HERO|WORKS):START-->.*?<!--\1:END-->", re.S)


def main():
    for rel, html in PAGES.items():
        path = os.path.join(ROOT, *rel.split("/"))
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if os.path.exists(path):  # 관리자가 채운 부분 보존
            with open(path, encoding="utf-8") as f:
                old = {m.group(1): m.group(0) for m in MARK.finditer(f.read())}
            html = MARK.sub(lambda m: old.get(m.group(1), m.group(0)), html)
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(html)
        print("wrote", rel)


if __name__ == "__main__":
    main()
