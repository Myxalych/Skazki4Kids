/*
 * Загрузка и отрисовка списка рассказов.
 *
 * Основной источник данных — статический `stories.json` (собирается на этапе
 * сборки), поэтому в браузере не нужны запросы к GitHub API. Если манифест
 * недоступен, используется запасной путь через GitHub API (как раньше).
 *
 * Функции чистые и тестируемые: в браузере модуль подключается через <script>
 * и доступен как window.Stories; в Node (Jest) — через module.exports.
 */
(function (root) {
  'use strict';

  var REPO = 'Myxalych/Skazki4Kids';
  var MANIFEST_URL = 'stories.json';
  var CONTENTS_URL = 'https://api.github.com/repos/' + REPO + '/contents/stories';
  var RAW_BASE = 'https://raw.githubusercontent.com/' + REPO + '/main/stories/';
  var STORY_FILE_REGEX = /^story\d+\.html$/;

  function isStoryFile(name) {
    return typeof name === 'string' && STORY_FILE_REGEX.test(name);
  }

  function getStoryNumber(name) {
    var match = typeof name === 'string' ? name.match(/\d+/) : null;
    return match ? parseInt(match[0], 10) : NaN;
  }

  /** Извлекает заголовок рассказа из HTML (первый <h1>). */
  function extractTitle(html, num) {
    var fallback = num + '. Рассказ';
    if (typeof html !== 'string') return fallback;
    var match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    if (!match) return fallback;
    var title = match[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
    return num + '. ' + title;
  }

  /** Нормализует запись манифеста к единому виду, используемому при отрисовке. */
  function normalizeEntry(entry) {
    var num = entry.num;
    return {
      num: num,
      title: /^\d+\./.test(entry.title) ? entry.title : num + '. ' + entry.title,
      file: entry.file || 'stories/story' + num + '.html',
      img: entry.img || 'img/story' + num + '.png',
      thumb: entry.thumb || entry.img || 'img/story' + num + '.png'
    };
  }

  /** Сортирует и нормализует записи манифеста по возрастанию номера. */
  function normalizeManifest(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .filter(function (e) {
        return e && typeof e.num === 'number';
      })
      .map(normalizeEntry)
      .sort(function (a, b) {
        return a.num - b.num;
      });
  }

  /** Создаёт DOM-карточку рассказа из нормализованной записи. */
  function createStoryCard(doc, entry) {
    var a = doc.createElement('a');
    a.className = 'story-card';
    a.href = entry.file;

    var img = doc.createElement('img');
    img.className = 'story-card__img';
    img.src = entry.thumb;
    img.alt = entry.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 480;
    img.height = 300;

    var h3 = doc.createElement('h3');
    h3.className = 'story-card__title';
    h3.textContent = entry.title;

    a.appendChild(img);
    a.appendChild(h3);
    return a;
  }

  /** Отрисовывает карточки в контейнере (очищая прежнее содержимое). */
  function renderStories(doc, container, entries) {
    container.textContent = '';
    var frag = doc.createDocumentFragment();
    entries.forEach(function (entry) {
      frag.appendChild(createStoryCard(doc, entry));
    });
    container.appendChild(frag);
  }

  /** Запасной путь: собрать записи через GitHub API (медленно, есть лимит). */
  function fetchFromApi(fetchFn) {
    return fetchFn(CONTENTS_URL)
      .then(function (resp) {
        if (!resp.ok) throw new Error('Не удалось загрузить список историй');
        return resp.json();
      })
      .then(function (files) {
        var stories = files
          .filter(function (f) {
            return f && isStoryFile(f.name);
          })
          .map(function (f) {
            return getStoryNumber(f.name);
          })
          .sort(function (a, b) {
            return a - b;
          });
        return stories.reduce(function (chain, num) {
          return chain.then(function (acc) {
            return fetchFn(RAW_BASE + 'story' + num + '.html')
              .then(function (r) {
                return r.text();
              })
              .then(function (text) {
                acc.push({ num: num, title: extractTitle(text, num) });
                return acc;
              })
              .catch(function () {
                acc.push({ num: num, title: num + '. Рассказ' });
                return acc;
              });
          });
        }, Promise.resolve([]));
      });
  }

  /**
   * Загружает рассказы (сначала манифест, затем — при неудаче — GitHub API)
   * и наполняет контейнер #stories-container карточками.
   */
  function loadStories(deps) {
    deps = deps || {};
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var doc = deps.document || (typeof document !== 'undefined' ? document : null);
    var container = doc.getElementById('stories-container');

    return fetchFn(MANIFEST_URL)
      .then(function (resp) {
        if (!resp.ok) throw new Error('no manifest');
        return resp.json();
      })
      .catch(function () {
        return fetchFromApi(fetchFn);
      })
      .then(function (entries) {
        renderStories(doc, container, normalizeManifest(entries));
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.error) console.error(err);
        if (container) {
          container.textContent = '';
          var msg = doc.createElement('p');
          msg.className = 'stories-error';
          msg.setAttribute('role', 'alert');
          msg.textContent = 'Не удалось загрузить список историй. Попробуйте обновить страницу.';
          container.appendChild(msg);
        }
      });
  }

  var api = {
    REPO: REPO,
    MANIFEST_URL: MANIFEST_URL,
    CONTENTS_URL: CONTENTS_URL,
    RAW_BASE: RAW_BASE,
    STORY_FILE_REGEX: STORY_FILE_REGEX,
    isStoryFile: isStoryFile,
    getStoryNumber: getStoryNumber,
    extractTitle: extractTitle,
    normalizeEntry: normalizeEntry,
    normalizeManifest: normalizeManifest,
    createStoryCard: createStoryCard,
    renderStories: renderStories,
    fetchFromApi: fetchFromApi,
    loadStories: loadStories
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Stories = api;
  }
})(typeof window !== 'undefined' ? window : this);
