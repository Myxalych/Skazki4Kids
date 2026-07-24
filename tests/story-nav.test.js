const StoryNav = require('../js/story-nav');

describe('parseCurrentNumber', () => {
  it('извлекает номер из пути', () => {
    expect(StoryNav.parseCurrentNumber('/Skazki4Kids/stories/story13.html')).toBe(13);
    expect(StoryNav.parseCurrentNumber('story1.html')).toBe(1);
    expect(StoryNav.parseCurrentNumber('/index.html')).toBeNaN();
  });
});

describe('toNumbers', () => {
  it('нормализует и сортирует номера из манифеста', () => {
    expect(StoryNav.toNumbers([{ num: 3 }, { num: 1 }, { num: 2 }])).toEqual([1, 2, 3]);
  });
  it('возвращает пустой массив для не-массива', () => {
    expect(StoryNav.toNumbers(null)).toEqual([]);
  });
});

describe('computeNeighbors (зацикленная навигация)', () => {
  const nums = [1, 2, 3, 12, 13];

  it('с первого ведёт назад на последний, вперёд на второй', () => {
    expect(StoryNav.computeNeighbors(1, nums)).toEqual({ prev: 13, next: 2 });
  });

  it('с последнего ведёт вперёд на первый, назад на предыдущий', () => {
    expect(StoryNav.computeNeighbors(13, nums)).toEqual({ prev: 12, next: 1 });
  });

  it('в середине берёт непосредственных соседей по списку', () => {
    expect(StoryNav.computeNeighbors(3, nums)).toEqual({ prev: 2, next: 12 });
  });

  it('возвращает null, если рассказов меньше двух или текущий не найден', () => {
    expect(StoryNav.computeNeighbors(1, [1])).toBeNull();
    expect(StoryNav.computeNeighbors(99, nums)).toBeNull();
  });
});

describe('render', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('создаёт .nav-buttons с корректными ссылками', () => {
    StoryNav.render(document, { prev: 13, next: 2 });
    const prev = document.querySelector('.prev-story');
    const next = document.querySelector('.next-story');
    expect(prev.getAttribute('href')).toBe('story13.html');
    expect(next.getAttribute('href')).toBe('story2.html');
    expect(prev.getAttribute('aria-label')).toBe('Предыдущий рассказ');
  });

  it('переиспользует существующий контейнер и очищает старые ссылки', () => {
    document.body.innerHTML =
      '<div class="nav-buttons"><a class="prev-story" href="story10.html">←</a></div>';
    StoryNav.render(document, { prev: 5, next: 7 });
    expect(document.querySelectorAll('.nav-buttons').length).toBe(1);
    expect(document.querySelector('.prev-story').getAttribute('href')).toBe('story5.html');
  });

  it('очищает кнопки, если соседей нет', () => {
    document.body.innerHTML = '<div class="nav-buttons"><a>x</a></div>';
    StoryNav.render(document, null);
    expect(document.querySelector('.nav-buttons').children.length).toBe(0);
  });
});

describe('initStoryNav', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="nav-buttons"></div>';
  });

  it('строит навигацию из манифеста для текущей страницы', async () => {
    const manifest = [{ num: 1 }, { num: 2 }, { num: 13 }];
    const fetchFn = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(manifest) })
    );

    await StoryNav.initStoryNav({
      fetch: fetchFn,
      document,
      pathname: '/stories/story13.html',
      manifestUrl: '../stories.json'
    });

    expect(document.querySelector('.next-story').getAttribute('href')).toBe('story1.html');
    expect(document.querySelector('.prev-story').getAttribute('href')).toBe('story2.html');
  });

  it('не падает, если манифест недоступен', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchFn = jest.fn(() => Promise.reject(new Error('offline')));
    await StoryNav.initStoryNav({ fetch: fetchFn, document, pathname: '/stories/story1.html' });
    expect(document.querySelector('.nav-buttons').children.length).toBe(0);
    warn.mockRestore();
  });
});
