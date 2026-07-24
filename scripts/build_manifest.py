"""Собирает статический манифест рассказов и WebP-миниатюры.

Запускается на этапе сборки (в workflow и локально). Убирает необходимость
обращаться к GitHub API из браузера: `index.html` читает готовый
`stories.json`, а сетка использует лёгкие миниатюры вместо полноразмерных PNG.

Использование:
    python scripts/build_manifest.py
"""
import json
import re
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - Pillow ставится в workflow
    Image = None

ROOT = Path(__file__).resolve().parent.parent
STORIES_DIR = ROOT / "stories"
IMAGES_DIR = ROOT / "img"
THUMB_DIR = IMAGES_DIR / "thumb"
MANIFEST = ROOT / "stories.json"

THUMB_WIDTH = 480
THUMB_QUALITY = 72


def story_number(name):
    """Извлекает номер рассказа из имени файла (story12.html -> 12)."""
    m = re.search(r"story(\d+)\.html$", name)
    return int(m.group(1)) if m else None


def extract_title(html, num):
    """Возвращает заголовок из первого <h1>; иначе — запасной вариант."""
    m = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.DOTALL)
    if not m:
        return f"Часть {num}"
    title = re.sub(r"<[^>]+>", "", m.group(1))
    return title.replace("&nbsp;", " ").strip()


def make_thumbnail(num):
    """Создаёт WebP-миниатюру для storyN.png. Возвращает относительный путь
    к миниатюре или к исходному изображению, если создать миниатюру нельзя."""
    src = IMAGES_DIR / f"story{num}.png"
    if not src.exists():
        return f"img/story{num}.png"
    if Image is None:
        return f"img/story{num}.png"
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    dst = THUMB_DIR / f"story{num}.webp"
    with Image.open(src) as im:
        im = im.convert("RGB")
        if im.width > THUMB_WIDTH:
            ratio = THUMB_WIDTH / im.width
            im = im.resize((THUMB_WIDTH, round(im.height * ratio)))
        im.save(dst, "WEBP", quality=THUMB_QUALITY, method=6)
    return f"img/thumb/story{num}.webp"


def build():
    entries = []
    for path in sorted(STORIES_DIR.glob("story*.html")):
        num = story_number(path.name)
        if num is None:
            continue
        title = extract_title(path.read_text(encoding="utf-8"), num)
        thumb = make_thumbnail(num)
        entries.append(
            {
                "num": num,
                "title": title,
                "file": f"stories/{path.name}",
                "img": f"img/story{num}.png",
                "thumb": thumb,
            }
        )
    entries.sort(key=lambda e: e["num"])
    MANIFEST.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return entries


if __name__ == "__main__":
    built = build()
    print(f"Манифест обновлён: {len(built)} рассказов -> {MANIFEST.name}")
