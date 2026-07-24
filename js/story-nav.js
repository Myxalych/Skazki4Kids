/*
 * Динамическая навигация между рассказами.
 *
 * Кнопки «назад/вперёд» строятся из манифеста stories.json во время загрузки
 * страницы, поэтому не зависят от количества опубликованных рассказов и не
 * требуют правки HTML при добавлении новых частей. Навигация зациклена:
 * с первой части «назад» ведёт на последнюю, с последней «вперёд» — на первую.
 *
 * UMD-модуль: в браузере доступен как window.StoryNav и авто-инициализируется;
 * в Node (Jest) экспортируется через module.exports для юнит-тестов.
 */
(function (root) {
  'use strict';

  /** Извлекает номер текущего рассказа из пути (…/story13.html -> 13). */
  function parseCurrentNumber(pathname) {
    var match = typeof pathname === 'string' ? pathname.match(/story(\d+)\.html/) : null;
    return match ? parseInt(match[1], 10) : NaN;
  }

  /** Нормализует список рассказов манифеста к отсортированному массиву номеров. */
  function toNumbers(entries) {
    if (!Array.isArray(entries)) return [];
    return entries
      .map(function (e) {
        return e && typeof e.num === 'number' ? e.num : parseInt(e && e.num, 10);
      })
      .filter(function (n) {
        return !isNaN(n);
      })
      .sort(function (a, b) {
        return a - b;
      });
  }

  /**
   * Возвращает номера предыдущего и следующего рассказа с зацикливанием.
   * Если рассказов меньше двух или текущий не найден — возвращает null.
   */
  function computeNeighbors(current, numbers) {
    var idx = numbers.indexOf(current);
    if (numbers.length < 2 || idx === -1) return null;
    var n = numbers.length;
    return {
      prev: numbers[(idx - 1 + n) % n],
      next: numbers[(idx + 1) % n]
    };
  }

  /** Создаёт/обновляет контейнер .nav-buttons двумя кнопками навигации. */
  function render(doc, neighbors) {
    var container = doc.querySelector('.nav-buttons');
    if (!container) {
      container = doc.createElement('div');
      container.className = 'nav-buttons';
      doc.body.appendChild(container);
    }
    if (!neighbors) {
      container.textContent = '';
      return container;
    }
    container.textContent = '';

    var prev = doc.createElement('a');
    prev.className = 'prev-story';
    prev.href = 'story' + neighbors.prev + '.html';
    prev.setAttribute('aria-label', 'Предыдущий рассказ');
    prev.textContent = '←';

    var next = doc.createElement('a');
    next.className = 'next-story';
    next.href = 'story' + neighbors.next + '.html';
    next.setAttribute('aria-label', 'Следующий рассказ');
    next.textContent = '→';

    container.appendChild(prev);
    container.appendChild(next);
    return container;
  }

  /** Загружает манифест и строит навигацию для текущей страницы рассказа. */
  function initStoryNav(deps) {
    deps = deps || {};
    var fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null);
    var doc = deps.document || (typeof document !== 'undefined' ? document : null);
    var pathname =
      deps.pathname ||
      (typeof location !== 'undefined' ? location.pathname : '');
    var manifestUrl = deps.manifestUrl || '../stories.json';

    return fetchFn(manifestUrl)
      .then(function (resp) {
        if (!resp.ok) throw new Error('no manifest');
        return resp.json();
      })
      .then(function (entries) {
        var current = parseCurrentNumber(pathname);
        render(doc, computeNeighbors(current, toNumbers(entries)));
      })
      .catch(function (err) {
        if (typeof console !== 'undefined' && console.warn) console.warn(err);
      });
  }

  var api = {
    parseCurrentNumber: parseCurrentNumber,
    toNumbers: toNumbers,
    computeNeighbors: computeNeighbors,
    render: render,
    initStoryNav: initStoryNav
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.StoryNav = api;
    if (typeof document !== 'undefined') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
          initStoryNav();
        });
      } else {
        initStoryNav();
      }
    }
  }
})(typeof window !== 'undefined' ? window : this);
