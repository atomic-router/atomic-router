import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it, vi } from "vitest";

import { createHistoryRouter, createRoute } from "../src";

const route = createRoute<{ postId: string }>();
const router = createHistoryRouter({ routes: [{ path: "/test/:postId", route }] });

describe("Routes creation", () => {
  it("Initialized with default values", () => {
    const scope = fork();
    expect(scope.getState(route.$isOpened)).toBe(false);
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe(".open() method", () => {
  it("Marks route as opened", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.open, {
      scope,
      params: { postId: "foo" },
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
  });

  it("Stores route params in $params", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.open, {
      scope,
      params: { postId: "foo" },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: "foo" });
  });

  it("Works without params passed", async () => {
    const scope = fork();
    const route = createRoute();
    const router = createHistoryRouter({ routes: [{ path: "/", route }] });
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.open, {
      scope,
      params: undefined,
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe(".navigate() method", () => {
  it("Marks route as opened", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: {} },
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
  });

  it("Stores route params in $params", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: "foo" });
  });

  it("Stores route query in $query", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: { test: "bar" } },
    });
    expect(scope.getState(route.$query)).toEqual({ test: "bar" });
  });

  it("Resets $query on .open() trigger", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: {} },
    });
    await allSettled(route.open, {
      scope,
      params: { postId: "foo" },
    });
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe("Lifecycle: .opened()", () => {
  it("Triggered on .open()/.navigate() calls", async () => {
    const cb = vi.fn();
    route.opened.watch(cb);
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: { test: "blah" } },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({
      params: { postId: "foo" },
      query: { test: "blah" },
    });
  });

  it("Does not get triggered if route is already opened", async () => {
    const cb = vi.fn();
    route.opened.watch(cb);
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.open, {
      scope,
      params: { postId: "foo" },
    });
    await allSettled(route.open, {
      scope,
      params: { postId: "bar" },
    });
    expect(cb).toBeCalledTimes(1);
  });
});

describe("Lifecycle: .updated()", () => {
  it("Does not get triggered if route is not opened", async () => {
    const cb = vi.fn();
    route.updated.watch(cb);
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.open, {
      scope,
      params: { postId: "foo" },
    });
    expect(cb).toBeCalledTimes(0);
  });

  it("Triggered on .open()/.navigate() calls if opened", async () => {
    const cb = vi.fn();
    route.updated.watch(cb);
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "foo" }, query: { test: "blah" } },
    });
    expect(cb).toHaveBeenCalledTimes(0);
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: "bar" }, query: { test: "baz" } },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({
      params: { postId: "bar" },
      query: { test: "baz" },
    });
  });
});
