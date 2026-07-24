import os
import re
import requests
import urllib.parse
from pathlib import Path
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
STORIES_DIR = Path("stories")
IMAGES_DIR = Path("img")
IMAGES_DIR.mkdir(exist_ok=True)

# 1. Находим все существующие рассказы
existing = sorted(STORIES_DIR.glob("story*.html"))
numbers = []
for f in existing:
    m = re.search(r"story(\d+)\.html", f.name)
    if m:
        numbers.append(int(m.group(1)))

next_num = max(numbers) + 1 if numbers else 1
print(f"Генерируем: story{next_num}.html")

# 2. Читаем ВСЕ предыдущие рассказы (для связи сюжета) и считаем их объём
all_stories_text = []
word_counts = []
for num in sorted(numbers):
    fpath = STORIES_DIR / f"story{num}.html"
    if fpath.exists():
        raw = fpath.read_text(encoding="utf-8")
        body = re.search(r"<article[^>]*>(.*?)</article>", raw, re.DOTALL) or re.search(
            r"<body[^>]*>(.*?)</body>", raw, re.DOTALL
        )
        if body:
            clean = re.sub(r"<[^>]+>", " ", body.group(1))
            clean = re.sub(r"\s+", " ", clean).strip()
            all_stories_text.append(f"[Часть {num}]: {clean[:800]}")
            word_counts.append(len(clean.split()))

context = "\n\n".join(all_stories_text[-10:])

# Целевой объём — как у предыдущих частей (в среднем, но не короче).
target_words = max(500, round(sum(word_counts) / len(word_counts))) if word_counts else 550
target_max = target_words + 150
print(f"Целевой объём: ~{target_words}-{target_max} слов")

# 3. Генерируем текст в стиле Стругацких и Азимова
system_prompt = f"""Ты — писатель-фантаст, работающий в стиле ранних 
Стругацких («Страна багровых туч», «Путь на Амальтею», «Стажёры») 
и Айзека Азимова («Я, робот», цикл о Foundation). 

Правила:
- Аудитория: дети 12 лет. Язык живой, но без упрощений.
- Жанры: научная фантастика, космос, роботы, открытия, загадки.
- ОБЯЗАТЕЛЬНО опирайся на события, персонажей и мир предыдущих частей.
- Развивай начатые сюжетные линии, возвращай старых героев.
- Никакого насилия, жестокости, безысходности.
- Юмор и ирония — как у Стругацких.
- Научная достоверность на уровне, понятном 12-летнему.
- Объём: {target_words}–{target_max} слов — не короче предыдущих частей.
- Заканчивай на интригующем вопросе или открытии.

Формат ответа СТРОГО:
ЗАГОЛОВОК: <название части>
ТЕКСТ: <текст с абзацами, разделёнными пустой строкой>"""

user_prompt = f"""Вот краткое содержание предыдущих частей:

{context if context else "(Это самая первая часть — придумай мир и героев с нуля.)"}

Напиши ПРОДОЛЖЕНИЕ — часть {next_num}. 
Обязательно свяжи с предыдущими событиями. 
Объём — не менее {target_words} слов, как в предыдущих частях, не сокращай. 
Верни ответ в указанном формате."""


def generate_answer(extra=""):
    return client.models.generate_content(
        model="gemini-flash-latest",
        contents=f"{system_prompt}\n\n{user_prompt}{extra}",
        config=types.GenerateContentConfig(max_output_tokens=4096, temperature=0.9),
    ).text


def parse_story_body(answer):
    tm = re.search(r"ТЕКСТ:\s*(.*)", answer, re.DOTALL)
    return (tm.group(1).strip() if tm else answer)


raw_answer = generate_answer()
# Если модель выдала слишком короткий текст — одна повторная попытка подлиннее.
if len(parse_story_body(raw_answer).split()) < int(target_words * 0.85):
    print("Ответ короче целевого объёма — повторная генерация")
    raw_answer = generate_answer(
        f"\n\nВАЖНО: предыдущий вариант был слишком коротким. "
        f"Напиши более развёрнутый рассказ объёмом не менее {target_words} слов."
    )

# Парсим ответ
title_match = re.search(r"ЗАГОЛОВОК:\s*(.+)", raw_answer)
title = title_match.group(1).strip() if title_match else f"Часть {next_num}"

text_match = re.search(r"ТЕКСТ:\s*(.*)", raw_answer, re.DOTALL)
story_body = text_match.group(1).strip() if text_match else raw_answer

paragraphs = [p.strip() for p in story_body.split("\n\n") if p.strip()]
html_paragraphs = "\n".join(f"    <p>{p}</p>" for p in paragraphs)

print(f"Заголовок: {title}")

# 4. Генерируем иллюстрацию (бесплатно, Pollinations)
img_prompt = (
    f"Science fiction children's book illustration, retro-futuristic style "
    f"inspired by 1960s Soviet sci-fi art, space exploration, robots, "
    f"warm colors, no text, no words. Scene: {title}. "
    f"Context: {paragraphs[0][:150] if paragraphs else title}"
)
img_url = (
    f"https://image.pollinations.ai/prompt/"
    f"{urllib.parse.quote(img_prompt)}"
    f"?width=1024&height=1024&nologo=true&seed={next_num * 7}"
)

img_data = requests.get(img_url, timeout=120).content
img_path = IMAGES_DIR / f"story{next_num}.png"
img_path.write_bytes(img_data)
print(f"Картинка: {img_path}")

# 5. Создаём HTML-файл рассказа (единый шаблон со стилизованными классами).
# Кнопки «назад/вперёд» строятся динамически на клиенте (js/story-nav.js)
# из stories.json, поэтому здесь только пустой контейнер — без жёстких ссылок.
story_html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#0b1026">
  <title>{title}</title>
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>
  <div class="nav-buttons"></div>
  <article class="story">
    <nav class="story-nav"><a href="../index.html">&larr; Все сказки</a></nav>
    <h1>{title}</h1>
    <img src="../img/story{next_num}.png" alt="{title}" class="story-image" loading="lazy" decoding="async">
{html_paragraphs}
  </article>
  <script src="../js/story-nav.js"></script>
</body>
</html>"""

story_path = STORIES_DIR / f"story{next_num}.html"
story_path.write_text(story_html, encoding="utf-8")
print(f"Рассказ: {story_path}")

# 6. Пересобираем манифест и миниатюры (используются главной страницей)
try:
    import build_manifest

    build_manifest.build()
    print("Манифест stories.json обновлён")
except Exception as exc:  # pragma: no cover
    print(f"Не удалось обновить манифест: {exc}")

print(f"✅ Готово! Часть {next_num}: «{title}»")
