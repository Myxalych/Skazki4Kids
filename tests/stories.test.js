const Stories = require('../js/stories');

describe('isStoryFile', () => {
  it('принимает story{N}.html и отклоняет прочее', () => {
    expect(Stories.isStoryFile('story1.html')).toBe(true);
    expect(Stories.isStoryFile('story12.html')).toBe(true);
    expect(Stories.isStoryFile('index.html')).toBe(false);
    expect(Stories.isStoryFile('story.html')).toBe(false);
    expect(Stories.isStoryFile(null)).toBe(false);
  });
});

describe('getStoryNumber', () => {
  it('извлекает номер из имени', () => {
    expect(Stories.getStoryNumber('story7.html')).toBe(7);
    expect(Stories.getStoryNumber('story.html')).toBeNaN();
  });
});

describe('extractTitle', () => {
  it('извлекает и чистит заголовок из h1', () => {
    expect(Stories.extractTitle('<h1>Тени</h1>', 1)).toBe('1. Тени');
    expect(Stories.extractTitle('<h1 class="x">Из&nbsp;за</h1>', 3)).toBe('3. Из за');
    expect(Stories.extractTitle('<h1>А <em>Б</em></h1>', 4)).toBe('4. А Б');
  });

  it('использует запасной вариант без h1', () => {
    expect(Stories.extractTitle('<p>нет</p>', 5)).toBe('5. Рассказ');
    expect(Stories.extractTitle(undefined, 9)).toBe('9. Рассказ');
  });
});

describe('normalizeEntry', () => {
  it('дополняет отсутствующие поля и не дублирует номер в заголовке', () => {
    expect(Stories.normalizeEntry({ num: 2, title: 'Огонь' })).toEqual({
      num: 2,
      title: '2. Огонь',
      file: 'stories/story2.html',
      img: 'img/story2.png',
      thumb: 'img/story2.png'
    });
  });

  it('сохраняет уже пронумерованный заголовок и переданные пути', () => {
    const e = Stories.normalizeEntry({
      num: 5,
      title: '5. Стихия',
      file: 'stories/story5.html',
      img: 'img/story5.png',
      thumb: 'img/thumb/story5.webp'
    });
    expect(e.title).toBe('5. Стихия');
    expect(e.thumb).toBe('img/thumb/story5.webp');
  });
});

describe('normalizeManifest', () => {
  it('фильтрует, нормализует и сортирует по номеру', () => {
    const out = Stories.normalizeManifest([
      { num: 2, title: 'Б' },
      null,
      { title: 'нет номера' },
      { num: 1, title: 'А' }
    ]);
    expect(out.map((e) => e.num)).toEqual([1, 2]);
    expect(out[0].title).toBe('1. А');
  });

  it('возвращает пустой массив для не-массива', () => {
    expect(Stories.normalizeManifest(null)).toEqual([]);
  });
});

describe('createStoryCard', () => {
  it('строит доступную карточку с миниатюрой', () => {
    const card = Stories.createStoryCard(
      document,
      Stories.normalizeEntry({ num: 4, title: 'Океаны', thumb: 'img/thumb/story4.webp' })
    );
    expect(card.tagName).toBe('A');
    expect(card.getAttribute('href')).toBe('stories/story4.html');
    const img = card.querySelector('img');
    expect(img.getAttribute('src')).toBe('img/thumb/story4.webp');
    expect(img.getAttribute('alt')).toBe('4. Океаны');
    expect(img.loading).toBe('lazy');
    expect(img.decoding).toBe('async');
    expect(card.querySelector('h3').textContent).toBe('4. Океаны');
  });
});

describe('loadStories', () => {
  let container;

  beforeEach(() => {
    document.body.innerHTML = '<div id="stories-container"></div>';
    container = document.getElementById('stories-container');
  });

  function ok(body) {
    return { ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve(body) };
  }

  it('отрисовывает карточки из манифеста stories.json одним запросом', async () => {
    const manifest = [
      { num: 2, title: 'Огонь', thumb: 'img/thumb/story2.webp' },
      { num: 1, title: 'Тени', thumb: 'img/thumb/story1.webp' }
    ];
    const fetchFn = jest.fn((url) => {
      expect(url).toBe(Stories.MANIFEST_URL);
      return Promise.resolve(ok(manifest));
    });

    await Stories.loadStories({ fetch: fetchFn, document });

    const cards = container.querySelectorAll('a.story-card');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('h3').textContent).toBe('1. Тени');
    expect(cards[1].querySelector('h3').textContent).toBe('2. Огонь');
  });

  it('откатывается на GitHub API, если манифест недоступен', async () => {
    const listing = [{ name: 'story1.html' }, { name: 'readme.md' }];
    const fetchFn = jest.fn((url) => {
      if (url === Stories.MANIFEST_URL) return Promise.resolve({ ok: false });
      if (url === Stories.CONTENTS_URL) return Promise.resolve(ok(listing));
      return Promise.resolve(ok('<h1>Первый</h1>'));
    });

    await Stories.loadStories({ fetch: fetchFn, document });

    const cards = container.querySelectorAll('a.story-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector('h3').textContent).toBe('1. Первый');
  });

  it('показывает сообщение об ошибке, если оба источника недоступны', async () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fetchFn = jest.fn(() => Promise.reject(new Error('offline')));

    await Stories.loadStories({ fetch: fetchFn, document });

    expect(container.querySelector('.stories-error')).not.toBeNull();
    errSpy.mockRestore();
  });
});
