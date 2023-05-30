/**
 * @jest-environment jsdom
 */
import { allSettled, createEvent, Event, fork, Store } from 'effector';
import { createMemoryHistory, History } from 'history';
import { describe, it, expect, vi, Mock } from 'vitest';
import {
  attachPaths,
  createRoute,
  createRouterDomain,
  rootDomain,
  setHistory,
  RouteQuery,
} from '../src';

const foo = createRoute();
const bar = createRoute();
const first = createRoute();
const firstClone = createRoute();
const withParams = createRoute<{ postId: string }>();
const hashed = createRoute<{ token: string }>();

attachPaths([
  [foo, '/foo'],
  [bar, '/bar'],
  [first, '/first'],
  [firstClone, '/first'],
  [withParams, '/posts/:postId'],
  [hashed, '/test/#/swap/:token'],
]);

describe('Initialization', () => {
  it('Sets opened routes on initialization', async () => {
    const history = createMemoryHistory();
    history.push('/foo');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
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
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
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
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(foo.$query)).toEqual({ bar: 'baz' });
    expect(scope.getState(bar.$query)).toEqual({});
    expect(scope.getState(first.$query)).toEqual({});
    expect(scope.getState(firstClone.$query)).toEqual({});
    expect(scope.getState(withParams.$query)).toEqual({});
    history.push('/bar?bar=baz2');
    expect(scope.getState(foo.$query)).toEqual({});
    expect(scope.getState(rootDomain.$query)).toEqual({ bar: 'baz2' });
    expect(scope.getState(bar.$query)).toEqual({ bar: 'baz2' });
    expect(scope.getState(first.$query)).toEqual({});
    expect(scope.getState(firstClone.$query)).toEqual({});
    expect(scope.getState(withParams.$query)).toEqual({});
  });

  it(`Doesn't trigger history again after push`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.replace('/foo?bar=baz');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });

    history.push('/bar?bar=baz2');

    expect(fn).toBeCalledTimes(2);
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "REPLACE",
          "pathname": "/foo",
          "search": "?bar=baz",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/bar",
          "search": "?bar=baz2",
          "state": null,
        },
      ]
    `);
  });

  it('Triggers .initialized() when history is set', async () => {
    const initialized = watch(rootDomain.initialized);
    const history = createMemoryHistory();
    history.push('/foo');
    const scope = fork();
    expect(initialized).toBeCalledTimes(0);
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(initialized).toBeCalledTimes(1);
    // TODO: Fix this
    // expect(initialized).toBeCalledWith({
    //   activeRoutes: [foo],
    //   path: "/foo",
    //   query: {},
    // });
  });
});

describe('Lifecycle', () => {
  it('Triggers .opened() with params and query', async () => {
    const opened = watch(withParams.opened);
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    history.push('/posts/foo?bar=baz');
    expect(opened).toBeCalledWith({
      params: { postId: 'foo' },
      query: { bar: 'baz' },
    });
  });

  it('Ensures .opened() is called only once per open', async () => {
    const opened = watch(withParams.opened);
    const history = createMemoryHistory();
    history.push('/foo');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    history.push('/posts/foo');
    history.push('/posts/bar');
    expect(opened).toBeCalledTimes(1);
  });

  it('Triggers .updated() when the same route is pushed', async () => {
    const updated = watch(withParams.updated);
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
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
    const closed = watch(bar.closed);
    const history = createMemoryHistory();
    history.push('/bar');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    history.push('/foo');
    expect(closed).toBeCalledTimes(1);
  });
});

describe('History', () => {
  it('Open previous route on .back() trigger', async () => {
    const history = createMemoryHistory();
    history.push('/foo');
    history.push('/bar');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(bar.$isOpened)).toBeTruthy();
    await allSettled(rootDomain.back, { scope });
    expect(scope.getState(bar.$isOpened)).toBeFalsy();
    expect(scope.getState(foo.$isOpened)).toBeTruthy();
  });

  it('Open next route on .forward() trigger', async () => {
    const history = createMemoryHistory();
    history.push('/foo');
    history.push('/bar');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(bar.$isOpened)).toBeTruthy();
    await allSettled(rootDomain.back, { scope });
    expect(scope.getState(bar.$isOpened)).toBeFalsy();
    expect(scope.getState(foo.$isOpened)).toBeTruthy();
  });

  it(`Doesn't trigger history again after back and forward`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push('/foo');
    history.push('/bar');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(fn).toBeCalledTimes(2);

    await allSettled(rootDomain.back, { scope });
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "PUSH",
          "pathname": "/foo",
          "search": "",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/bar",
          "search": "",
          "state": null,
        },
        {
          "action": "POP",
          "pathname": "/foo",
          "search": "",
          "state": null,
        },
      ]
    `);

    await allSettled(rootDomain.forward, { scope });
    expect(fn).toBeCalledTimes(4);
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "PUSH",
          "pathname": "/foo",
          "search": "",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/bar",
          "search": "",
          "state": null,
        },
        {
          "action": "POP",
          "pathname": "/foo",
          "search": "",
          "state": null,
        },
        {
          "action": "POP",
          "pathname": "/bar",
          "search": "",
          "state": null,
        },
      ]
    `);
  });
});

describe('Query', () => {
  it('Updates .$query on path change', async () => {
    const history = createMemoryHistory();
    history.push('/foo?param=test');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(rootDomain.$query)).toEqual({
      param: 'test',
    });
  });

  it('Updates path on $query change', async () => {
    const history = createMemoryHistory();
    history.push('/foo?param=test');
    const changed = createEvent<RouteQuery>();
    rootDomain.$query.on(changed, (_, next) => next);
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(rootDomain.$query)).toEqual({ param: 'test' });
    await allSettled(changed, {
      scope,
      params: { bar: 'baz' },
    });
    expect(history.location.search).toBe('?bar=baz');
    expect(scope.getState(rootDomain.$query)).toEqual({
      bar: 'baz',
    });
  });

  it(`Doesn't trigger history again after back and forward`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push('/foo?param=test');
    const changed = createEvent<Record<string, string>>();
    rootDomain.$query.on(changed, (_, next) => next);
    const scope = fork();

    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(fn).toBeCalledTimes(1);

    await allSettled(changed, {
      scope,
      params: { foo: 'bar', bar: 'baz' },
    });
    expect(scope.getState(rootDomain.$query)).toEqual({
      foo: 'bar',
      bar: 'baz',
    });
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "PUSH",
          "pathname": "/foo",
          "search": "?param=test",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/foo",
          "search": "?foo=bar&bar=baz",
          "state": null,
        },
      ]
    `);
  });
});

describe('Hash mode', () => {
  it('If hash is set as path, uses it', async () => {
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    history.push('/test/#/swap/ETH');
    expect(scope.getState(hashed.$isOpened)).toBe(true);
    expect(scope.getState(hashed.$params)).toEqual({ token: 'ETH' });
  });
});

// describe("Custom ser/de for query string", () => {
//   const router = createHistoryRouter({
//     routes: [
//       { route: foo, path: "/foo" },
//       { route: bar, path: "/bar" },
//       { route: first, path: "/first" },
//       { route: firstClone, path: "/first" },
//       { route: withParams, path: "/posts/:postId" },
//       { route: hashed, path: "/test/#/swap/:token" },
//     ],
//     serialize: {
//       read: (query) =>
//         queryString.parse(query, {
//           arrayFormat: "separator",
//           arrayFormatSeparator: "|",
//         }),
//       write: (params) =>
//         queryString.stringify(params, {
//           arrayFormat: "separator",
//           arrayFormatSeparator: "|",
//         }),
//     },
//   });

//   it("Supports custom serde for query strings", async () => {
//     const updated = watch(withParams.updated);
//     const history = createMemoryHistory();
//     history.push("/");
//     const scope = fork();
//     await allSettled(setHistory, {
//       scope,
//       params: { history, domain: rootDomain },
//     });

//     history.push("/posts/foo");
//     history.push("/posts/bar?baz=1234|4321");
//     await void "sleep";

//     expect(updated).toBeCalledTimes(1);
//     expect(updated).toBeCalledWith({
//       params: { postId: "bar" },
//       query: { baz: ["1234", "4321"] },
//     });
//   });

//   it(`Doesn't trigger history again after back and forward`, async () => {
//     const history = createMemoryHistory();
//     const fn = listenHistoryChanges(history);
//     history.push("/");
//     const changed = createEvent<Record<string, (string | number)[]>>();
//     sample({ clock: changed, target: $query });
//     const scope = fork();
//     await allSettled(setHistory, {
//       scope,
//       params: { history, domain: rootDomain },
//     });
//     expect(fn).toBeCalledTimes(1);

//     await allSettled(changed, {
//       scope,
//       params: { foo: [1, 2, 3, 4], bar: ["a", "b", "c"] },
//     });
//     expect(fn).toBeCalledTimes(2);
//     expect(argumentHistory(fn)).toMatchInlineSnapshot(`
//       [
//         {
//           "action": "PUSH",
//           "pathname": "/",
//           "search": "",
//           "state": null,
//         },
//         {
//           "action": "PUSH",
//           "pathname": "/",
//           "search": "?bar=a|b|c&foo=1|2|3|4",
//           "state": {},
//         },
//       ]
//     `);
//   });
// });

describe('Other checks', () => {
  it('Supports multiple routes opened at the same time', async () => {
    const history = createMemoryHistory();
    history.push('/first');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(scope.getState(first.$isOpened)).toBe(true);
    expect(scope.getState(firstClone.$isOpened)).toBe(true);
  });

  // NOTE: Should we support this behavior really?
  it.skip('If the same route is passed twice, trigger it only once', async () => {
    const domain = createRouterDomain();

    const testRoute = createRoute({ domain });
    const opened = watch(testRoute.opened);
    const updated = watch(testRoute.updated);
    const history = createMemoryHistory();
    history.push('/test/foo');

    attachPaths([
      [testRoute, '/test/:foo'],
      [testRoute, '/test/:foo/:bar'],
    ]);

    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    history.push('/test/bar');
    history.push('/test/foo/bar');
    expect(opened).toBeCalledTimes(1);
    expect(updated).toBeCalledTimes(2);
  });
});

describe('Router with params.base', () => {
  describe('Root URI (e.g. /root)', () => {
    const domain = createRouterDomain({
      base: '/root',
    });

    const foo = createRoute({ domain });
    const bar = createRoute({ domain });
    attachPaths([
      [foo, '/foo'],
      [bar, '/bar'],
    ]);

    it('Opens correct route', async () => {
      const history = createMemoryHistory();
      history.push('/root/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it('Ignores if root does not match', async () => {
      const history = createMemoryHistory();
      history.push('/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain: rootDomain },
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

      await allSettled(setHistory, {
        scope,
        params: { history, domain: rootDomain },
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

  it('Really replaces history item', async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push('/foo');
    history.push('/bar');
    const scope = fork();
    await allSettled(setHistory, {
      scope,
      params: { history, domain: rootDomain },
    });
    expect(fn).toBeCalledTimes(2);
    expect(history.index).toBe(2);

    await allSettled(first.navigate, {
      scope,
      params: { query: {}, params: {}, replace: true },
    });
    expect(fn).toBeCalledTimes(3);
    expect(history.index).toBe(2); // Index is not increased
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "PUSH",
          "pathname": "/foo",
          "search": "",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/bar",
          "search": "",
          "state": null,
        },
        {
          "action": "REPLACE",
          "pathname": "/first",
          "search": "",
          "state": null,
        },
      ]
    `);
  });

  describe('Hash root (/#)', () => {
    const domain = createRouterDomain({
      base: '/#',
    });

    const foo = createRoute({ domain });
    const bar = createRoute({ domain });

    attachPaths([
      [foo, '/foo'],
      [bar, '/bar'],
    ]);

    it('Opens correct route', async () => {
      const history = createMemoryHistory();
      history.push('/#/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it('Ignores if root does not match', async () => {
      const history = createMemoryHistory();
      history.push('/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain: rootDomain },
      });
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });

  // NOTE: Not needed feature, but would be cool to add in a future
  describe.skip('URL (e.g. https://foobar.com)', () => {
    it('Sets correct route', async () => {
      const domain = createRouterDomain({
        base: 'https://foobar.com',
      });
      const foo = createRoute({ domain });
      const bar = createRoute({ domain });

      attachPaths([
        [foo, '/foo'],
        [bar, '/bar'],
      ]);

      const history = createMemoryHistory();
      history.push('https://foobar.com/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      expect(history.createHref(history.location)).toBe(
        'https://foobar.com/foo'
      );
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it('Ignores if root does not match', async () => {
      const history = createMemoryHistory();
      history.push('https://foobared.com/foo');
      const scope = fork();
      await allSettled(setHistory, {
        scope,
        params: { history, domain: rootDomain },
      });
      expect(history.createHref(history.location)).toBe(
        'https://foobared.com/foo'
      );
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });
});

// describe("Hydrate", () => {
//   it("Should creates without errors", async () => {
//     expect(() => {
//       const router = createHistoryRouter({
//         routes: [
//           { route: foo, path: "/foo" },
//           { route: bar, path: "/bar" },
//           { route: withParams, path: "/posts/:postId" },
//         ],
//         controls,
//         hydrate: true,
//       });
//     }).not.toThrow();
//   });

//   it("Should not run route logic after hydration", async () => {
//     const url = "/posts/123?foo=bar";
//     const serverRouter = createHistoryRouter({
//       routes: [
//         { route: foo, path: "/foo" },
//         { route: bar, path: "/bar" },
//         { route: withParams, path: "/posts/:postId" },
//       ],
//       controls,
//     });

//     const serverHistory = createMemoryHistory();
//     serverHistory.push(url);
//     const serverScope = fork();
//     const withParamsOpenedFn = watch(withParams.opened);
//     const withParamsUpdatedFx = watch(withParams.updated);
//     const withParamsClosedFx = watch(withParams.closed);

//     await allSettled(serversetHistory, {
//       scope: serverScope,
//       params: serverHistory,
//     });
//     expect(withParamsOpenedFn).toBeCalled();
//     expect(withParamsUpdatedFx).not.toBeCalled();
//     expect(withParamsClosedFx).not.toBeCalled();

//     const data = serialize(serverScope);
//     const clientScope = fork({ values: data });
//     const clientRouter = createHistoryRouter({
//       routes: [
//         { route: foo, path: "/foo" },
//         { route: bar, path: "/bar" },
//         { route: withParams, path: "/posts/:postId" },
//       ],
//       controls,
//       hydrate: true,
//     });
//     const clientHistory = createMemoryHistory();
//     clientHistory.push(url);
//     await allSettled(clientsetHistory, {
//       scope: clientScope,
//       params: clientHistory,
//     });
//     expect(withParamsOpenedFn).toBeCalledTimes(1);
//     expect(withParamsUpdatedFx).not.toBeCalled();
//     expect(withParamsClosedFx).not.toBeCalled();
//     expect(clientScope.getState(withParams.$isOpened)).toBe(true);
//     expect(clientScope.getState(withParams.$query)).toEqual({ foo: "bar" });
//     expect(clientScope.getState(withParams.$params)).toEqual({ postId: "123" });
//   });
// });

function watch<T>(unit: Store<T> | Event<T>): Mock {
  const fn = vi.fn();
  unit.watch(fn);
  return fn;
}

function argumentHistory(fn: Mock) {
  return fn.mock.calls.map(([value]) => value);
}

function listenHistoryChanges(history: History) {
  const fn = vi.fn();
  history.listen((state) => {
    return fn({
      action: state.action,
      pathname: state.location.pathname,
      search: state.location.search,
      state: state.location.state,
    });
  });
  return fn;
}
