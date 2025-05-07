import { createMemoryHistory } from "history";
import { describe, it, expect } from "vitest";
import { allSettled, createEvent, createStore, fork, restore } from "effector";

import { createRoute, createHistoryRouter, querySync, createRouterControls } from "../src";

const createRouter = () => {
  const route = createRoute();
  const routeA = createRoute();
  const routeB = createRoute();
  const notOpenedRoute = createRoute();

  const controls = createRouterControls();

  const router = createHistoryRouter({
    routes: [
      { path: "/", route },
      { path: "/not-opened", route: notOpenedRoute },
      { path: "/a", route: routeA },
      { path: "/b", route: routeB },
    ],
    controls,
  });

  return { router, controls, route, routeA, routeB, notOpenedRoute };
};

describe("querySync", () => {
  it("Updates query when source is changed", async () => {
    const { router, controls } = createRouter();
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, "");

    querySync({
      source: { fromSource: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: "test",
    });

    expect(scope.getState(controls.$query)).toEqual({
      fromSource: "test",
    });
    expect(history.location.search).toEqual(`?fromSource=test`);
  });

  it("Updates source when query is changed", async () => {
    const { router, controls } = createRouter();
    const $q = createStore("");

    querySync({
      source: { fromQuery: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/?fromQuery=foo");

    expect(scope.getState($q)).toEqual("foo");
  });

  it("Sets source to defaultState if query param is missing", async () => {
    const { router, controls } = createRouter();
    const qChanged = createEvent<string>();
    const $q = createStore("defaultState");

    $q.on(qChanged, (_, next) => next);

    querySync({
      source: { defaultState: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: "bar",
    });
    history.push("/?anotherQueryParam=test");

    expect(scope.getState($q)).toEqual("defaultState");
  });

  it("Ignore source updates if passed route is not opened", async () => {
    const { router, controls, notOpenedRoute } = createRouter();
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, "");

    querySync({
      source: { shouldBeIgnored: $q },
      controls,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: "test",
    });

    expect(history.location.search).toEqual("");
  });

  it("Ignore history updates if passed route is not opened", async () => {
    const { router, controls, notOpenedRoute } = createRouter();
    const $q = createStore("");

    querySync({
      source: { q: $q },
      controls,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push("/?foo=bar");

    expect(scope.getState($q)).toEqual("");
  });

  it("Triggers history updates only on `clock` trigger (if present)", async () => {
    const { router, controls } = createRouter();
    const qChanged = createEvent<string>();
    const clock = createEvent();
    const $q = restore(qChanged, "");

    querySync({
      source: { q: $q },
      clock,
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: "test",
    });
    await allSettled(qChanged, {
      scope,
      params: "bar",
    });

    expect(history.location.search).toEqual("");

    await allSettled(clock, {
      scope,
    });
    expect(history.location.search).toEqual("?q=bar");
  });

  describe("cleanup.irrelevant option", () => {
    it("Removes irrelevant params if set to true", async () => {
      const { router, controls, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q },
        route: routeA,
        controls,
        cleanup: {
          irrelevant: true,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      history.push("/a?foo=bar");

      expect(history.location.search).toEqual("?foo=bar");

      await allSettled(qChanged, {
        scope,
        params: "test",
      });

      expect(history.location.search).toEqual("?q=test");
    });

    it("Keeps irrelevant params if set to false", async () => {
      const { router, controls, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q },
        route: routeA,
        controls,
        cleanup: {
          irrelevant: false,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      history.push("/a?foo=bar");

      expect(history.location.search).toEqual("?foo=bar");

      await allSettled(qChanged, {
        scope,
        params: "test",
      });

      expect(history.location.search).toEqual("?foo=bar&q=test");
    });

    it("Keeps params passed to `preserve`", async () => {
      const { router, controls, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q },
        route: routeA,
        controls,
        cleanup: {
          irrelevant: true,
          preserve: ["foo"],
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      history.push("/a?foo=bar&bar=baz");

      expect(history.location.search).toEqual("?foo=bar&bar=baz");

      await allSettled(qChanged, {
        scope,
        params: "test",
      });

      expect(history.location.search).toEqual("?foo=bar&q=test");
    });
  });

  describe("cleanup.empty option", () => {
    it("Removes empty params if set to true", async () => {
      const { router, controls } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q },
        controls,
        cleanup: {
          empty: true,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      await allSettled(qChanged, {
        scope,
        params: "f",
      });

      expect(history.location.search).toEqual("?q=f");

      await allSettled(qChanged, {
        scope,
        params: "",
      });

      expect(history.location.search).toEqual("?");
    });

    it("Passes empty params if set to false", async () => {
      const { router, controls } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q },
        controls,
        cleanup: {
          empty: false,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      await allSettled(qChanged, {
        scope,
        params: "f",
      });

      expect(history.location.search).toEqual("?q=f");

      await allSettled(qChanged, {
        scope,
        params: "",
      });

      expect(history.location.search).toEqual("?q=");
    });

    it("Preserves empty params if they are present in cleanup.preserve", async () => {
      const { router, controls } = createRouter();
      const fooChanged = createEvent<string>();
      const qChanged = createEvent<string>();
      const $foo = restore(qChanged, "");
      const $q = restore(qChanged, "");

      querySync({
        source: { q: $q, foo: $foo },
        controls,
        cleanup: {
          empty: true,
          preserve: ["q"],
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(router.setHistory, {
        scope,
        params: history,
      });
      await allSettled(qChanged, {
        scope,
        params: "f",
      });
      await allSettled(fooChanged, {
        scope,
        params: "f",
      });

      expect(history.location.search).toEqual("?q=f&foo=f");

      await allSettled(qChanged, {
        scope,
        params: "",
      });

      expect(history.location.search).toEqual("?q=");
    });
  });
});
