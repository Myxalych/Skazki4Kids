/*
 * Логика динамической загрузки списка рассказов.
 *
 * Функции вынесены из index.html в отдельный модуль, чтобы их можно было
 * покрыть unit-тестами. В браузере файл подключается через <script>, а
 * функции доступны глобально (window.Stories). В Node (Jest) тот же файл
 * экспортируется через module.exports.
 */
(function (root) {
  'use strict';

  var REPO = 'Myxalych/Skazki4Kids';
  var CONTENTS_URL = 'https://api.github.com/repos/' + REPO + '/contents/stories';
  var RAW_BASE = 'https://raw.githubusercontent.com/' + REPO + '/main/stories/';
  var STORY_FILE_REGEX = /^story\d+\.html$/;

  /**
   * Проверяет, является ли имя файла файлом рассказа (storyX.html).
   * @param {string} name
   * @returns {boolean}
   */
  function isStoryFile(name) {
    return typeof name === 'string' && STORY_FILE_REGEX.test(name);
  }

  /**
   * Оставляет только файлы рассказов из списка, полученного от GitHub API.
   * @param {Array<{name: string}>} files
   * @returns {Array<{name: string}>}
   */
  function filterStoryFiles(files) {
    if (!Array.isArray(files)) return [];
    return files.filter(function (file) {
      return file && isStoryFile(file.name);
    });
  }

  /**
   * Извлекает номер рассказа из имени файла (story12.html -> 12).
   * @param {string} name
   * @returns {number} NaN, если номер не найден
   */
  function getStoryNumber(name) {
    var match = typeof name === 'string' ? name.match(/\d+/) : null;
    return match ? parseInt(match[0], 10) : NaN;
  }

  /**
   * Сортирует файлы рассказов по возрастанию номера (не мутирует исходный массив).
   * @param {Array<{name: string}>} stories
   * @returns {Array<{name: string}>}
   */
  function sortStoriesByNumber(stories) {
    return stories.slice().sort(function (a, b) {
      return getStoryNumber(a.name) - getStoryNumber(b.name);
    });
  }

  /**
   * Извлекает заголовок рассказа из HTML (первый <h1>).
   * Возвращает строку вида "N. Заголовок"; если h1 не найден —
   * запасной вариант "N. Рассказ".
   * @param {string} html
   * @param {number} num
   * @returns {string}
   */
  function extractTitle(html, num) {
    var fallback = num + '. Рассказ';
    if (typeof html !== 'string') return fallback;
    var match = html.match(/<h1[^>]*>(.*?)<\/h1>/);
    if (!match) return fallback;
    return num + '. ' + match[1].replace(/&nbsp;/g, ' ');
  }

  /**
   * Создаёт DOM-карточку рассказа.
   * @param {Document} doc
   * @param {{name: string}} story
   * @param {number} num
   * @param {string} title
   * @returns {HTMLAnchorElement}
   */
  function createStoryCard(doc, story, num, title) {
    var a = doc.createElement('a');
    a.className = 'story-card';
    a.href = 'stories/' + story.name;

    var img = doc.createElement('img');
    img.src = 'img/story' + num + '.png';
    img.alt = title;
    img.loading = 'lazy';

    var h3 = doc.createElement('h3');
    h3.textContent = title;

    a.appendChild(img);
    a.appendChild(h3);
    return a;
  }

  /**
   * Загружает список рассказов и наполняет контейнер карточками.
   * Зависимости (fetch, document) можно передать для тестирования.
   * @param {{fetch?: Function, document?: Document}} [deps]
   * @returns {Promise<void>}
   */
  function loadStories(deps) {
    deps = deps || {};
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var doc = deps.document || (typeof document !== 'undefined' ? document : null);

    return Promise.resolve()
      .then(function () {
        return fetchFn(CONTENTS_URL);
      })
      .then(function (resp) {
        if (!resp.ok) throw new Error('Не удалось загрузить список историй');
        return resp.json();
      })
      .then(function (files) {
        var container = doc.getElementById('stories-container');
        var stories = sortStoriesByNumber(filterStoryFiles(files));

        return stories.reduce(function (chain, story) {
          return chain.then(function () {
            var num = getStoryNumber(story.name);
            return Promise.resolve()
              .then(function () {
                return fetchFn(RAW_BASE + story.name);
              })
              .then(function (res) {
                return res.text();
              })
              .then(function (text) {
                return extractTitle(text, num);
              })
              .catch(function () {
                return num + '. Рассказ';
              })
              .then(function (title) {
                container.appendChild(createStoryCard(doc, story, num, title));
              });
          });
        }, Promise.resolve());
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.error) console.error(err);
        if (doc) {
          var container = doc.getElementById('stories-container');
          if (container) container.textContent = 'Ошибка загрузки списка историй.';
        }
      });
  }

  var api = {
    REPO: REPO,
    CONTENTS_URL: CONTENTS_URL,
    RAW_BASE: RAW_BASE,
    STORY_FILE_REGEX: STORY_FILE_REGEX,
    isStoryFile: isStoryFile,
    filterStoryFiles: filterStoryFiles,
    getStoryNumber: getStoryNumber,
    sortStoriesByNumber: sortStoriesByNumber,
    extractTitle: extractTitle,
    createStoryCard: createStoryCard,
    loadStories: loadStories
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Stories = api;
  }
})(typeof window !== 'undefined' ? window : this);
