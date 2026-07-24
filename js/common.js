/*
 * Общие элементы страниц сайта «Сказки для детей».
 *
 * Раньше «шапка» (header), плавающие кнопки навигации и «подвал» (footer)
 * копировались в каждый файл storyX.html, а текст подвала — ещё и в
 * index.html. Теперь эта разметка генерируется из одного места.
 *
 * Страница рассказа задаёт только уникальное содержимое внутри <article> и
 * ссылки на соседние рассказы через атрибуты data-prev / data-next на <body>.
 */
(function () {
  'use strict';

  var FOOTER_TEXT = 'Сайт создан с помощью агента ChatGPT.';
  var HOME_HREF = '../index.html';
  var HOME_TEXT = '← На главную';

  function renderFooter(parent) {
    var footer = document.createElement('footer');
    var p = document.createElement('p');
    p.textContent = FOOTER_TEXT;
    footer.appendChild(p);
    (parent || document.body).appendChild(footer);
    return footer;
  }

  function renderHeader(title) {
    var header = document.createElement('header');
    var h1 = document.createElement('h1');
    h1.textContent = title;
    var nav = document.createElement('nav');
    var home = document.createElement('a');
    home.href = HOME_HREF;
    home.textContent = HOME_TEXT;
    nav.appendChild(home);
    header.appendChild(h1);
    header.appendChild(nav);
    return header;
  }

  function renderNavButtons(prevHref, nextHref) {
    var wrap = document.createElement('div');
    wrap.className = 'nav-buttons';
    if (prevHref) {
      var prev = document.createElement('a');
      prev.className = 'prev-story';
      prev.href = prevHref;
      prev.textContent = '←';
      wrap.appendChild(prev);
    }
    if (nextHref) {
      var next = document.createElement('a');
      next.className = 'next-story';
      next.href = nextHref;
      next.textContent = '→';
      wrap.appendChild(next);
    }
    return wrap;
  }

  function initStoryPage() {
    var body = document.body;
    var header = renderHeader(document.title);
    var navButtons = renderNavButtons(body.dataset.prev, body.dataset.next);
    body.insertBefore(navButtons, body.firstChild);
    body.insertBefore(header, body.firstChild);
    renderFooter(body);
  }

  function init() {
    if (document.body.hasAttribute('data-story')) {
      initStoryPage();
    } else {
      renderFooter(document.body);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Site = {
    FOOTER_TEXT: FOOTER_TEXT,
    renderFooter: renderFooter,
    renderHeader: renderHeader,
    renderNavButtons: renderNavButtons,
    initStoryPage: initStoryPage
  };
})();
