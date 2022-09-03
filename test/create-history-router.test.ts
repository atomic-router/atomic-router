/**
 * @jest-environment jsdom
 */
import { allSettled, fork } from 'effector';
import { createMemoryHistory } from 'history';
import { createHistoryRouter, createRoute } from '../src';
import queryString from 'query-string';

const foo = createRoute();
const bar = createRoute();
const first = createRoute();
const firstClone = createRoute();
const withParams = createRoute<{ postId: string }>();
const hashed = createRoute<{ token: string }>();

const router = createHistoryRouter({
  routes: [
    { route: foo, path: '/foo' },
    { route: bar, path: '/bar' },
    { route: first, path: '/first' },
    { route: firstClone, path: '/first' },
    { route: withParams, path: '/posts/:postId' },
    { route: hashed, path: '/test/#/swap/:token' },
  ],
});

describe('Initialization', () => {
  it('Sets opened routes on initialization', async () => {
    const history = createMemoryHistory();
    history.push('/foo');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(foo.$isOpened)).toBe(true);
    expect(scope.getState(bar.$isOpened)).toBe(false);
    expect(scope.getState(first.$isOpened)).toBe(false);
    expect(scope.getState(firstClone.$isOpened)).toBe(false);
    expect(scope.getState(withParams.$isOpened)).toBe(false);
  });

  it('Puts params to the specific route.$params', async () => {
    const history = createMemoryHistory();
    history.push('/posts/123');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(foo.$params)).toEqual({});
    expect(scope.getState(bar.$params)).toEqual({});
    expect(scope.getState(first.$params)).toEqual({});
    expect(scope.getState(firstClone.$params)).toEqual({});
    expect(scope.getState(withParams.$params)).toEqual({ postId: '123' });
  });

  it('Puts query to the specific route.$query', async () => {
    const history = createMemoryHistory();
    history.push('/foo?bar=baz');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(foo.$query)).toEqual({ bar: 'baz' });
    expect(scope.getState(bar.$query)).toEqual({});
    expect(scope.getState(first.$query)).toEqual({});
    expect(scope.getState(firstClone.$query)).toEqual({});
    expect(scope.getState(withParams.$query)).toEqual({});
  });
});

describe('Lifecycle', () => {
  it('Triggers .opened() with params and query', async () => {
    const opened = jest.fn();
    withParams.opened.watch(opened);
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/posts/foo?bar=baz');
    expect(opened).toBeCalledWith({
      params: { postId: 'foo' },
      query: { bar: 'baz' },
    });
  });

  it('Ensures .opened() is called only once per open', async () => {
    const opened = jest.fn();
    withParams.opened.watch(opened);
    const history = createMemoryHistory();
    history.push('/foo');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/posts/foo');
    history.push('/posts/bar');
    expect(opened).toBeCalledTimes(1);
  });

  it('Triggers .updated() when the same route is pushed', async () => {
    const updated = jest.fn();
    withParams.updated.watch(updated);
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/posts/foo');
    history.push('/posts/bar?baz=1234');
    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith({
      params: { postId: 'bar' },
      query: { baz: '1234' },
    });
  });

  it('Triggers .closed() when the route is closed', async () => {
    const closed = jest.fn();
    bar.closed.watch(closed);
    const history = createMemoryHistory();
    history.push('/bar');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/foo');
    expect(closed).toBeCalledTimes(1);
  });
});

describe('Hash mode', () => {
  it('If hash is set as path, uses it', async () => {
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/test/#/swap/ETH');
    expect(scope.getState(hashed.$isOpened)).toBe(true);
    expect(scope.getState(hashed.$params)).toEqual({ token: 'ETH' });
  });
});

describe('Other checks', () => {
  it('Supports custom serde for query strings', async () => {
    const router = createHistoryRouter({
      routes: [
        { route: foo, path: '/foo' },
        { route: bar, path: '/bar' },
        { route: first, path: '/first' },
        { route: firstClone, path: '/first' },
        { route: withParams, path: '/posts/:postId' },
        { route: hashed, path: '/test/#/swap/:token' },
      ],
      serialize: {
        read: (query) =>
          queryString.parse(query, {
            arrayFormat: 'separator',
            arrayFormatSeparator: '|',
          }),
        write: (params) =>
          queryString.stringify(params, {
            arrayFormat: 'separator',
            arrayFormatSeparator: '|',
          }),
      },
    });
    const updated = jest.fn();
    withParams.updated.watch(updated);
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/posts/foo');
    history.push('/posts/bar?baz=1234|4321');
    await sleep(0);
    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith({
      params: { postId: 'bar' },
      query: { baz: ['1234', '4321'] },
    });
  });

  it('Supports multiple routes opened at the same time', async () => {
    const history = createMemoryHistory();
    history.push('/first');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(first.$isOpened)).toBe(true);
    expect(scope.getState(firstClone.$isOpened)).toBe(true);
  });

  it('If the same route is passed twice, trigger it only once', async () => {
    const testRoute = createRoute();
    const opened = jest.fn();
    testRoute.opened.watch(opened);
    const updated = jest.fn();
    testRoute.updated.watch(updated);
    const history = createMemoryHistory();
    history.push('/test/foo');
    const router = createHistoryRouter({
      routes: [
        { route: testRoute, path: '/test/:foo' },
        { route: testRoute, path: '/test/:foo/:bar' },
      ],
    });
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/test/bar');
    history.push('/test/foo/bar');
    expect(opened).toBeCalledTimes(1);
    expect(updated).toBeCalledTimes(2);
  });
});

describe('Router with params.base', () => {
  describe('Root URI (e.g. /root)', () => {
    const foo = createRoute();
    const bar = createRoute();
    const router = createHistoryRouter({
      base: '/root',
      routes: [
        { route: foo, path: '/foo' },
        { route: bar, path: '/bar' },
      ],
    });

    it('Opens correct route', async () => {
      const history = createMemoryHistory();
      history.push('/root/foo');
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it('Ignores if root does not match', async () => {
      const history = createMemoryHistory();
      history.push('/foo');
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });

  describe('Hash root (/#)', () => {
    const foo = createRoute();
    const bar = createRoute();
    const router = createHistoryRouter({
      base: '/#',
      routes: [
        { route: foo, path: '/foo' },
        { route: bar, path: '/bar' },
      ],
    });

    it('Opens correct route', async () => {
      const history = createMemoryHistory();
      history.push('/#/foo');
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it('Ignores if root does not match', async () => {
      const history = createMemoryHistory();
      history.push('/foo');
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });

  describe('Navigate', () => {
    it('Should replace history if replace option passed', async () => {
      const scope = fork();

      const history = createMemoryHistory({
        initialEntries: ['/foo', '/bar'],
      });

      const { index } = history;

      await allSettled(router.setHistory, {
        scope,
        params: history,
      });

      await allSettled(first.navigate, {
        scope,
        params: {
          query: {},
          params: {},
          replace: true,
        },
      });

      expect(history.index).toBe(index);

      expect(history.location.pathname).toBe('/first');
    });
  });

  // NOTE: Not needed feature, but would be cool to add in a future
  // describe('URL (e.g. https://foobar.com)', () => {
  //   it('Sets correct route', async () => {
  //     const foo = createRoute();
  //     const bar = createRoute();
  //     const router = createHistoryRouter({
  //       base: 'https://foobar.com',
  //       routes: [
  //         { route: foo, path: '/foo' },
  //         { route: bar, path: '/bar' },
  //       ],
  //     });

  //     const history = createMemoryHistory();
  //     history.push('https://foobar.com/foo');
  //     const scope = fork();
  //     await allSettled(router.setHistory, {
  //       scope,
  //       params: history,
  //     });
  //     expect(history.createHref(history.location)).toBe(
  //       'https://foobar.com/foo'
  //     );
  //     expect(scope.getState(foo.$isOpened)).toBe(true);
  //   });

  //   it('Ignores if root does not match', async () => {
  //     const history = createMemoryHistory();
  //     history.push('https://foobared.com/foo');
  //     const scope = fork();
  //     await allSettled(router.setHistory, {
  //       scope,
  //       params: history,
  //     });
  //     expect(history.createHref(history.location)).toBe(
  //       'https://foobared.com/foo'
  //     );
  //     expect(scope.getState(foo.$isOpened)).toBe(false);
  //   });
  // });
});
