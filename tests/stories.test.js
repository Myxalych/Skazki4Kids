const Stories = require('../js/stories');

describe('isStoryFile', () => {
  it('принимает корректные имена файлов рассказов', () => {
    expect(Stories.isStoryFile('story1.html')).toBe(true);
    expect(Stories.isStoryFile('story12.html')).toBe(true);
  });

  it('отклоняет некорректные имена', () => {
    expect(Stories.isStoryFile('story.html')).toBe(false);
    expect(Stories.isStoryFile('story1.htm')).toBe(false);
    expect(Stories.isStoryFile('index.html')).toBe(false);
    expect(Stories.isStoryFile('astory1.html')).toBe(false);
    expect(Stories.isStoryFile('story1.html.bak')).toBe(false);
  });

  it('безопасно обрабатывает нестроковые значения', () => {
    expect(Stories.isStoryFile(undefined)).toBe(false);
    expect(Stories.isStoryFile(null)).toBe(false);
    expect(Stories.isStoryFile(5)).toBe(false);
  });
});

describe('filterStoryFiles', () => {
  it('оставляет только файлы рассказов', () => {
    const files = [
      { name: 'story1.html' },
      { name: 'index.html' },
      { name: 'story2.html' },
      { name: 'readme.md' },
      { name: 'notes.txt' }
    ];
    expect(Stories.filterStoryFiles(files).map((f) => f.name)).toEqual([
      'story1.html',
      'story2.html'
    ]);
  });

  it('игнорирует null/undefined элементы', () => {
    const files = [null, undefined, { name: 'story3.html' }];
    expect(Stories.filterStoryFiles(files)).toEqual([{ name: 'story3.html' }]);
  });

  it('возвращает пустой массив для не-массива', () => {
    expect(Stories.filterStoryFiles(null)).toEqual([]);
    expect(Stories.filterStoryFiles(undefined)).toEqual([]);
    expect(Stories.filterStoryFiles({})).toEqual([]);
  });
});

describe('getStoryNumber', () => {
  it('извлекает номер из имени файла', () => {
    expect(Stories.getStoryNumber('story1.html')).toBe(1);
    expect(Stories.getStoryNumber('story12.html')).toBe(12);
  });

  it('возвращает NaN, если цифр нет', () => {
    expect(Stories.getStoryNumber('story.html')).toBeNaN();
    expect(Stories.getStoryNumber(undefined)).toBeNaN();
  });
});

describe('sortStoriesByNumber', () => {
  it('сортирует по возрастанию числового номера', () => {
    const stories = [
      { name: 'story10.html' },
      { name: 'story2.html' },
      { name: 'story1.html' },
      { name: 'story12.html' }
    ];
    expect(Stories.sortStoriesByNumber(stories).map((s) => s.name)).toEqual([
      'story1.html',
      'story2.html',
      'story10.html',
      'story12.html'
    ]);
  });

  it('не мутирует исходный массив', () => {
    const stories = [{ name: 'story2.html' }, { name: 'story1.html' }];
    const copy = stories.slice();
    Stories.sortStoriesByNumber(stories);
    expect(stories).toEqual(copy);
  });
});

describe('extractTitle', () => {
  it('извлекает заголовок из первого h1', () => {
    const html = '<html><h1>Тени</h1><h1>Второй</h1></html>';
    expect(Stories.extractTitle(html, 1)).toBe('1. Тени');
  });

  it('заменяет &nbsp; на пробелы', () => {
    const html = '<h1>Из&nbsp;за&nbsp;горизонта</h1>';
    expect(Stories.extractTitle(html, 3)).toBe('3. Из за горизонта');
  });

  it('обрабатывает атрибуты в теге h1', () => {
    const html = '<h1 class="title" id="x">Заголовок</h1>';
    expect(Stories.extractTitle(html, 7)).toBe('7. Заголовок');
  });

  it('использует запасной вариант, если h1 не найден', () => {
    expect(Stories.extractTitle('<p>нет заголовка</p>', 5)).toBe('5. Рассказ');
    expect(Stories.extractTitle(undefined, 9)).toBe('9. Рассказ');
  });
});

describe('createStoryCard', () => {
  it('создаёт ссылку-карточку с картинкой и заголовком', () => {
    const card = Stories.createStoryCard(document, { name: 'story4.html' }, 4, '4. Заголовок');
    expect(card.tagName).toBe('A');
    expect(card.className).toBe('story-card');
    expect(card.getAttribute('href')).toBe('stories/story4.html');

    const img = card.querySelector('img');
    expect(img.getAttribute('src')).toBe('img/story4.png');
    expect(img.getAttribute('alt')).toBe('4. Заголовок');
    expect(img.loading).toBe('lazy');

    const h3 = card.querySelector('h3');
    expect(h3.textContent).toBe('4. Заголовок');
  });
});

describe('loadStories', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="stories-container"></div>';
    container = document.getElementById('stories-container');
  });

  function makeResponse(body) {
    return {
      ok: true,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(body)
    };
  }

  it('наполняет контейнер отсортированными карточками', async () => {
    const listing = [
      { name: 'story2.html' },
      { name: 'story1.html' },
      { name: 'readme.md' }
    ];
    const raw = {
      'story1.html': '<h1>Первый</h1>',
      'story2.html': '<h1>Второй</h1>'
    };
    const fetchFn = jest.fn((url) => {
      if (url === Stories.CONTENTS_URL) return Promise.resolve(makeResponse(listing));
      const name = url.replace(Stories.RAW_BASE, '');
      return Promise.resolve(makeResponse(raw[name]));
    });

    await Stories.loadStories({ fetch: fetchFn, document });

    const cards = container.querySelectorAll('a.story-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('h3').textContent).toBe('1. Первый');
    expect(cards[1].querySelector('h3').textContent).toBe('2. Второй');
    expect(cards[0].getAttribute('href')).toBe('stories/story1.html');
  });

  it('использует запасной заголовок, если загрузка текста не удалась', async () => {
    const listing = [{ name: 'story1.html' }];
    const fetchFn = jest.fn((url) => {
      if (url === Stories.CONTENTS_URL) return Promise.resolve(makeResponse(listing));
      return Promise.reject(new Error('network'));
    });

    await Stories.loadStories({ fetch: fetchFn, document });

    const cards = container.querySelectorAll('a.story-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('h3').textContent).toBe('1. Рассказ');
  });

  it('показывает сообщение об ошибке, когда ответ не ok', async () => {
    const fetchFn = jest.fn(() => Promise.resolve({ ok: false }));
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await Stories.loadStories({ fetch: fetchFn, document });

    expect(container.textContent).toBe('Ошибка загрузки списка историй.');
    errSpy.mockRestore();
  });
});
