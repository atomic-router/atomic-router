/**
 * @jest-environment jsdom
 */
import * as queryString from "query-string";
import {
  type Event,
  type Store,
  type StoreWritable,
  allSettled,
  createEvent,
  createWatch,
  fork,
  sample,
  serialize,
} from "effector";
import { type History, createMemoryHistory } from "history";
import { type Mock, describe, expect, it, vi } from "vitest";

import { createRoute, createRouterControls } from "../src";
import { createHistoryRouter } from "../src/methods/create-history-router";

const foo = createRoute();
const bar = createRoute();
const first = createRoute();
const firstClone = createRoute();
const withParams = createRoute<{ postId: string }>();
const hashed = createRoute<{ token: string }>();

const controls = createRouterControls();

const router = createHistoryRouter({
  routes: [
    { route: foo, path: "/foo" },
    { route: bar, path: "/bar" },
    { route: first, path: "/first" },
    { route: firstClone, path: "/first" },
    { route: withParams, path: "/posts/:postId" },
    { route: hashed, path: "/test/#/swap/:token" },
  ],
  controls,
});

describe("Initialization", () => {
  it("Sets opened routes on initialization", async () => {
    const history = createMemoryHistory();
    history.push("/foo");
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

  it("Puts params to the specific route.$params", async () => {
    const history = createMemoryHistory();
    history.push("/posts/123");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(foo.$params)).toEqual({});
    expect(scope.getState(bar.$params)).toEqual({});
    expect(scope.getState(first.$params)).toEqual({});
    expect(scope.getState(firstClone.$params)).toEqual({});
    expect(scope.getState(withParams.$params)).toEqual({ postId: "123" });
  });

  it("Puts query to the specific route.$query", async () => {
    const history = createMemoryHistory();
    history.push("/foo?bar=baz");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(foo.$query)).toEqual({ bar: "baz" });
    expect(scope.getState(bar.$query)).toEqual({});
    expect(scope.getState(first.$query)).toEqual({});
    expect(scope.getState(firstClone.$query)).toEqual({});
    expect(scope.getState(withParams.$query)).toEqual({});
    history.push("/bar?bar=baz2");
    expect(scope.getState(foo.$query)).toEqual({ bar: "baz" });
    expect(scope.getState(bar.$query)).toEqual({ bar: "baz2" });
    expect(scope.getState(first.$query)).toEqual({});
    expect(scope.getState(firstClone.$query)).toEqual({});
    expect(scope.getState(withParams.$query)).toEqual({});
  });

  it(`Doesn't trigger history again after push`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.replace("/foo?bar=baz");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    history.push("/bar?bar=baz2");

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

  it("Triggers .initialized() when history is set", async () => {
    const initialized = watch(router.initialized);
    const history = createMemoryHistory();
    history.push("/foo");
    const scope = fork();
    expect(initialized).toBeCalledTimes(0);
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(initialized).toBeCalledTimes(1);
    expect(initialized).toBeCalledWith({
      activeRoutes: [foo],
      path: "/foo",
      query: {},
    });
  });

  it("Triggers route.opened on .setHistory() call (hydrate is not set)", async () => {
    const history = createMemoryHistory({
      initialEntries: ["/foo"],
    });

    const opened = watch(foo.opened);
    const scope = fork();

    expect(opened).toBeCalledTimes(0);

    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    expect(opened).toBeCalledTimes(1);
  });

  it("Triggers route.opened on .setHistory() call (hydrate: false)", async () => {
    const hydratedRouter = createHistoryRouter({
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
        { route: first, path: "/first" },
        { route: firstClone, path: "/first" },
        { route: withParams, path: "/posts/:postId" },
        { route: hashed, path: "/test/#/swap/:token" },
      ],
      controls,
      /**
       * Explicitly set hydrate to `false`
       */
      hydrate: false,
    });
    const history = createMemoryHistory({
      initialEntries: ["/foo"],
    });

    const opened = watch(foo.opened);
    const scope = fork();

    expect(opened).toBeCalledTimes(0);

    await allSettled(hydratedRouter.setHistory, {
      scope,
      params: history,
    });

    expect(opened).toBeCalledTimes(1);
  });

  it("Does not trigger route.opened on .setHistory() call (hydrate: true)", async () => {
    const hydratedRouter = createHistoryRouter({
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
        { route: first, path: "/first" },
        { route: firstClone, path: "/first" },
        { route: withParams, path: "/posts/:postId" },
        { route: hashed, path: "/test/#/swap/:token" },
      ],
      controls,
      /**
       * Explicitly set hydrate to `true`
       */
      hydrate: true,
    });
    const history = createMemoryHistory({
      initialEntries: ["/foo"],
    });

    const opened = watch(foo.opened);
    const scope = fork();

    expect(opened).toBeCalledTimes(0);

    await allSettled(hydratedRouter.setHistory, {
      scope,
      params: history,
    });

    expect(opened).toBeCalledTimes(0);
  });

  it("Triggers route.opened on .setHistory() call (hydrate: false + scope is initilized from serialized data)", async () => {
    const hydratedRouter = createHistoryRouter({
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
        { route: first, path: "/first" },
        { route: firstClone, path: "/first" },
        { route: withParams, path: "/posts/:postId" },
        { route: hashed, path: "/test/#/swap/:token" },
      ],
      controls,
      /**
       * Explicitly set hydrate to `false`
       */
      hydrate: false,
    });
    const history = createMemoryHistory({
      initialEntries: ["/posts/42?kek=pek"],
    });

    const opened = watch(withParams.opened);
    const ssrScope = fork();

    expect(opened).toBeCalledTimes(0);

    await allSettled(hydratedRouter.setHistory, {
      scope: ssrScope,
      params: history,
    });

    expect(opened).toBeCalledTimes(1);

    const data = serialize(ssrScope);

    const clientScope = fork({ values: data });

    expect(opened).toBeCalledTimes(1);
    expect(clientScope.getState(withParams.$isOpened)).toBe(true);
    expect(clientScope.getState(withParams.$params)).toEqual({ postId: "42" });
    expect(clientScope.getState(withParams.$query)).toEqual({ kek: "pek" });

    await allSettled(hydratedRouter.setHistory, {
      scope: clientScope,
      params: createMemoryHistory({
        initialEntries: ["/posts/42?kek=pek"],
      }),
    });

    expect(opened).toBeCalledTimes(2);
    expect(clientScope.getState(withParams.$params)).toEqual({ postId: "42" });
    expect(clientScope.getState(withParams.$query)).toEqual({ kek: "pek" });
    expect(ssrScope.getState(withParams.$params)).toEqual(clientScope.getState(withParams.$params));
    expect(ssrScope.getState(withParams.$query)).toEqual(clientScope.getState(withParams.$query));
  });
});

describe("Lifecycle", () => {
  it(`"route.open()" trigger navigation`, async () => {
    const history = createMemoryHistory();
    history.push("/foo");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    const push = vi.fn();

    createWatch({ scope, fn: push, unit: router.push });

    await allSettled(bar.open, { scope });

    expect(push).toHaveBeenCalled();
  });

  it(`"route.navigate()" trigger navigation`, async () => {
    const history = createMemoryHistory();
    history.push("/foo");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    const push = vi.fn();

    createWatch({ scope, fn: push, unit: router.push });

    await allSettled(bar.navigate, { scope, params: { params: { a: 1 }, query: { b: 2 } } });

    expect(push).toHaveBeenCalledWith({
      method: "push",
      params: {
        a: 1,
      },
      path: "/bar?b=2",
      query: {
        b: 2,
      },
    });
    expect(scope.getState(bar.$isOpened)).toBeTruthy();
  });

  it("Triggers .opened() with params and query", async () => {
    const opened = watch(withParams.opened);
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/posts/foo?bar=baz");
    expect(opened).toBeCalledWith({
      params: { postId: "foo" },
      query: { bar: "baz" },
    });
  });

  it("Ensures .opened() is called only once per open", async () => {
    const opened = watch(withParams.opened);
    const history = createMemoryHistory();
    history.push("/foo");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/posts/foo");
    history.push("/posts/bar");
    expect(opened).toBeCalledTimes(1);
  });

  it("Triggers .updated() when the same route is pushed", async () => {
    const updated = watch(withParams.updated);
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/posts/foo");
    history.push("/posts/bar?baz=1234");
    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith({
      params: { postId: "bar" },
      query: { baz: "1234" },
    });
  });

  it("Triggers .closed() when the route is closed", async () => {
    const closed = watch(bar.closed);
    const history = createMemoryHistory();
    history.push("/bar");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/foo");
    expect(closed).toBeCalledTimes(1);
  });
});

describe("History", () => {
  it("Open previous route on .back() trigger", async () => {
    const history = createMemoryHistory();
    history.push("/foo");
    history.push("/bar");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(bar.$isOpened)).toBeTruthy();
    await allSettled(router.back, { scope });
    expect(scope.getState(bar.$isOpened)).toBeFalsy();
    expect(scope.getState(foo.$isOpened)).toBeTruthy();
  });

  it("Open previous route on .forward() trigger", async () => {
    const history = createMemoryHistory();
    history.push("/foo");
    history.push("/bar");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(bar.$isOpened)).toBeTruthy();
    await allSettled(router.back, { scope });
    expect(scope.getState(bar.$isOpened)).toBeFalsy();
    expect(scope.getState(foo.$isOpened)).toBeTruthy();
  });

  it(`Doesn't trigger history again after back and forward`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push("/foo");
    history.push("/bar");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(fn).toBeCalledTimes(2);

    await allSettled(router.back, { scope });
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

    await allSettled(router.forward, { scope });
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

  it(`Not update routes when blocked`, async () => {
    const history = createMemoryHistory();
    history.push("/foo");

    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    const unblock = history.block(() => {});

    const barOpened = vi.fn();
    createWatch({
      scope,
      unit: bar.opened,
      fn: barOpened,
    });

    await allSettled(bar.open, { scope });

    expect(scope.getState(bar.$isOpened)).toBeFalsy();
    expect(scope.getState(foo.$isOpened)).toBeTruthy();
    expect(barOpened).not.toHaveBeenCalled();

    unblock();

    await allSettled(bar.open, { scope });

    expect(scope.getState(bar.$isOpened)).toBeTruthy();
    expect(scope.getState(foo.$isOpened)).toBeFalsy();
    expect(barOpened).toHaveBeenCalled();
  });
});

describe("Query", () => {
  it("Updates .$query on path change", async () => {
    const history = createMemoryHistory();
    history.push("/foo?param=test");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(router.$query)).toEqual({
      param: "test",
    });
  });

  it("Updates path on $query change", async () => {
    const history = createMemoryHistory();
    history.push("/foo?param=test");
    const changed = createEvent<Record<string, string>>();
    (router.$query as StoreWritable<{}>).on(changed, (_, next) => next);
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(history.location.search).toBe("?param=test");
    await allSettled(changed, {
      scope,
      params: { bar: "baz" },
    });
    expect(scope.getState(router.$query)).toEqual({ bar: "baz" });
    expect(history.location.search).toBe("?bar=baz");
    expect(scope.getState(router.$query)).toEqual({
      bar: "baz",
    });
  });

  it(`Doesn't trigger history again after back and forward`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push("/foo?param=test");
    const changed = createEvent<Record<string, string>>();
    (router.$query as StoreWritable<{}>).on(changed, (_, next) => next);
    const scope = fork();

    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(fn).toBeCalledTimes(1);

    await allSettled(changed, {
      scope,
      params: { foo: "bar", bar: "baz" },
    });
    expect(scope.getState(router.$query)).toEqual({ foo: "bar", bar: "baz" });
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
          "state": {},
        },
      ]
    `);
  });
});

describe("Hash mode", () => {
  it("If hash is set as path, uses it", async () => {
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/test/#/swap/ETH");
    expect(scope.getState(hashed.$isOpened)).toBe(true);
    expect(scope.getState(hashed.$params)).toEqual({ token: "ETH" });
  });
});

describe("Custom ser/de for query string", () => {
  const router = createHistoryRouter({
    routes: [
      { route: foo, path: "/foo" },
      { route: bar, path: "/bar" },
      { route: first, path: "/first" },
      { route: firstClone, path: "/first" },
      { route: withParams, path: "/posts/:postId" },
      { route: hashed, path: "/test/#/swap/:token" },
    ],
    serialize: {
      read: (query) =>
        queryString.parse(query, {
          arrayFormat: "separator",
          arrayFormatSeparator: "|",
        }),
      write: (params) =>
        queryString.stringify(params, {
          arrayFormat: "separator",
          arrayFormatSeparator: "|",
        }),
    },
  });

  it("Supports custom serde for query strings", async () => {
    const updated = watch(withParams.updated);
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    history.push("/posts/foo");
    history.push("/posts/bar?baz=1234|4321");
    await void "sleep";

    expect(updated).toBeCalledTimes(1);
    expect(updated).toBeCalledWith({
      params: { postId: "bar" },
      query: { baz: ["1234", "4321"] },
    });
  });

  it(`Doesn't trigger history again after back and forward`, async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push("/");
    const changed = createEvent<Record<string, (string | number)[]>>();
    sample({ clock: changed, target: router.$query as StoreWritable<{}> });
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(fn).toBeCalledTimes(1);

    await allSettled(changed, {
      scope,
      params: { foo: [1, 2, 3, 4], bar: ["a", "b", "c"] },
    });
    expect(fn).toBeCalledTimes(2);
    expect(argumentHistory(fn)).toMatchInlineSnapshot(`
      [
        {
          "action": "PUSH",
          "pathname": "/",
          "search": "",
          "state": null,
        },
        {
          "action": "PUSH",
          "pathname": "/",
          "search": "?bar=a|b|c&foo=1|2|3|4",
          "state": {},
        },
      ]
    `);
  });
});

describe("Other checks", () => {
  it("Supports multiple routes opened at the same time", async () => {
    const history = createMemoryHistory();
    history.push("/first");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(scope.getState(first.$isOpened)).toBe(true);
    expect(scope.getState(firstClone.$isOpened)).toBe(true);
  });

  it("If the same route is passed twice, trigger it only once", async () => {
    const testRoute = createRoute();
    const opened = watch(testRoute.opened);
    const updated = watch(testRoute.updated);
    const history = createMemoryHistory();
    history.push("/test/foo");
    const router = createHistoryRouter({
      routes: [
        { route: testRoute, path: "/test/:foo" },
        { route: testRoute, path: "/test/:foo/:bar" },
      ],
    });
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/test/bar");
    history.push("/test/foo/bar");
    expect(opened).toBeCalledTimes(1);
    expect(updated).toBeCalledTimes(2);
  });
});

describe("Router with params.base", () => {
  describe("Root URI (e.g. /root)", () => {
    const foo = createRoute();
    const bar = createRoute();
    const router = createHistoryRouter({
      base: "/root",
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
      ],
    });

    it("Opens correct route", async () => {
      const history = createMemoryHistory();
      history.push("/root/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it("Ignores if root does not match", async () => {
      const history = createMemoryHistory();
      history.push("/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });

  describe("Navigate", () => {
    it("Should replace history if replace option passed", async () => {
      const scope = fork();

      const history = createMemoryHistory({
        initialEntries: ["/foo", "/bar"],
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

      expect(history.location.pathname).toBe("/first");
    });
  });

  it("Really replaces history item", async () => {
    const history = createMemoryHistory();
    const fn = listenHistoryChanges(history);
    history.push("/foo");
    history.push("/bar");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
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
          "state": {},
        },
      ]
    `);
  });

  describe("Hash root (/#)", () => {
    const foo = createRoute();
    const bar = createRoute();
    const router = createHistoryRouter({
      base: "/#",
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
      ],
    });

    it("Opens correct route", async () => {
      const history = createMemoryHistory();
      history.push("/#/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it("Ignores if root does not match", async () => {
      const history = createMemoryHistory();
      history.push("/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });

  // NOTE: Not needed feature, but would be cool to add in a future
  describe.skip("URL (e.g. https://foobar.com)", () => {
    it("Sets correct route", async () => {
      const foo = createRoute();
      const bar = createRoute();
      const router = createHistoryRouter({
        base: "https://foobar.com",
        routes: [
          { route: foo, path: "/foo" },
          { route: bar, path: "/bar" },
        ],
      });

      const history = createMemoryHistory();
      history.push("https://foobar.com/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(history.createHref(history.location)).toBe("https://foobar.com/foo");
      expect(scope.getState(foo.$isOpened)).toBe(true);
    });

    it("Ignores if root does not match", async () => {
      const history = createMemoryHistory();
      history.push("https://foobared.com/foo");
      const scope = fork();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      expect(history.createHref(history.location)).toBe("https://foobared.com/foo");
      expect(scope.getState(foo.$isOpened)).toBe(false);
    });
  });
});

describe("Hydrate", () => {
  it("Should creates without errors", async () => {
    expect(() => {
      createHistoryRouter({
        routes: [
          { route: foo, path: "/foo" },
          { route: bar, path: "/bar" },
          { route: withParams, path: "/posts/:postId" },
        ],
        controls,
        hydrate: true,
      });
    }).not.toThrow();
  });

  it("Should not run route logic after hydration", async () => {
    const url = "/posts/123?foo=bar";
    const serverRouter = createHistoryRouter({
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
        { route: withParams, path: "/posts/:postId" },
      ],
      controls,
    });

    const serverHistory = createMemoryHistory();
    serverHistory.push(url);
    const serverScope = fork();
    const withParamsOpenedFn = watch(withParams.opened);
    const withParamsUpdatedFx = watch(withParams.updated);
    const withParamsClosedFx = watch(withParams.closed);

    await allSettled(serverRouter.setHistory, {
      scope: serverScope,
      params: serverHistory,
    });
    expect(withParamsOpenedFn).toBeCalled();
    expect(withParamsUpdatedFx).not.toBeCalled();
    expect(withParamsClosedFx).not.toBeCalled();

    const data = serialize(serverScope);
    const clientScope = fork({ values: data });
    const clientRouter = createHistoryRouter({
      routes: [
        { route: foo, path: "/foo" },
        { route: bar, path: "/bar" },
        { route: withParams, path: "/posts/:postId" },
      ],
      controls,
      hydrate: true,
    });
    const clientHistory = createMemoryHistory();
    clientHistory.push(url);
    await allSettled(clientRouter.setHistory, {
      scope: clientScope,
      params: clientHistory,
    });
    expect(withParamsOpenedFn).toBeCalledTimes(1);
    expect(withParamsUpdatedFx).not.toBeCalled();
    expect(withParamsClosedFx).not.toBeCalled();
    expect(clientScope.getState(withParams.$isOpened)).toBe(true);
    expect(clientScope.getState(withParams.$query)).toEqual({ foo: "bar" });
    expect(clientScope.getState(withParams.$params)).toEqual({ postId: "123" });
  });
});

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
  history.listen((state) =>
    fn({
      action: state.action,
      pathname: state.location.pathname,
      search: state.location.search,
      state: state.location.state,
    }),
  );
  return fn;
}
