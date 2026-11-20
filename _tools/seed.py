# -*- coding: utf-8 -*-
"""기존(v1) 사진으로 처음 자료를 만드는 1회용 도구. 이미 _private/content.json 이 있으면 아무것도 하지 않습니다."""
import json, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "images")
OUT = os.path.join(ROOT, "_private", "content.json")
if os.path.exists(OUT):
    sys.exit("이미 자료가 있습니다: " + OUT)

def save(im, path, mx, q):
    im = im.convert("RGB"); im.thumbnail((mx, mx), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "JPEG", quality=q, optimize=True, progressive=True)
    return im.size

WORKS = [
 ("sfa-open-house", "SFA AI Robotics Open House", "리플렛·브로슈어", ["portfolio/project-001-sfa-open-house.jpg"]),
 ("yean-kim-genealogy", "예안김씨 세보해설", "책자·도서", ["portfolio/project-002-yean-kim-genealogy.jpg"]),
 ("korea-public-forum", "한국 지방 공기업 정책포럼", "리플렛·브로슈어", ["portfolio/project-003-korea-public-forum.jpg"]),
 ("fire-education", "소방안전강사 장애학생지원 역량 강화", "책자·도서", ["portfolio/project-004-fire-education.jpg", "portfolio/project-003-life-theater.jpg"]),
 ("student-research", "학생탐구활동 연구일지", "책자·도서", ["portfolio/project-005-student-research.jpg"]),
 ("hahm-ensemble", "더함앙상블", "포스터", ["portfolio/project-006-hahm-ensemble.jpg"]),
 ("bookdream", "책드림, 행복드림", "리플렛·브로슈어", ["hero-main.jpg"]),
 ("life-theater", "인생극장 제1막", "책자·도서", ["portfolio/project-006-mgpk-msds.jpg"]),
]
works, order = [], []
for n, (slug, title, cat, files) in enumerate(WORKS, 1):
    wid = "w%03d" % n
    photos = []
    for i, f in enumerate(files, 1):
        im = Image.open(os.path.join(SRC, f))
        pid = "p%d" % i
        base = os.path.join(ROOT, "media", "works", wid)
        w, h = save(im.copy(), os.path.join(base, pid + ".jpg"), 2000, 86)
        tw, th = save(im.copy(), os.path.join(base, pid + "_t.jpg"), 900, 82)
        photos.append({"id": pid, "w": w, "h": h, "tw": tw, "th": th})
    works.append({"id": wid, "slug": slug, "title": title, "status": "public", "category": cat, "desc": "", "specs": [],
                  "photos": photos, "cover": "p1", "thumbFit": "cover", "thumbPos": [50, 50],
                  "created": "2026-11-18", "updated": "2026-11-18"})
    order.append(wid)

hero = Image.open(os.path.join(SRC, "about-studio.png"))
hw, hh = save(hero.copy(), os.path.join(ROOT, "media", "hero", "hero-studio.jpg"), 2600, 86)
og = hero.convert("RGB"); s = max(1200 / og.width, 630 / og.height)
og = og.resize((round(og.width * s), round(og.height * s)), Image.LANCZOS)
l, t = (og.width - 1200) // 2, (og.height - 630) // 2
og.crop((l, t, l + 1200, t + 630)).save(os.path.join(ROOT, "media", "og.jpg"), "JPEG", quality=84)

content = {"version": 1,
           "hero": {"image": "media/hero/hero-studio.jpg", "w": hw, "h": hh, "posPc": [50, 50], "posMo": [50, 50], "scrim": 55},
           "categories": ["리플렛·브로슈어", "책자·도서", "포스터", "현수막·배너", "스티커·라벨", "명함·봉투", "기타"],
           "works": works, "order": order}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(content, f, ensure_ascii=False, indent=1); f.write("\n")
print("seeded", len(works), "works")
