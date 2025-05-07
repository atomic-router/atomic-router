import { allSettled, createEffect, createEvent, createWatch, fork, sample } from "effector";
import { describe, it, expect, vi } from "vitest";
import { createRoute, chainRoute, createHistoryRouter } from "../src";
import { createMemoryHistory } from "history";

const sleep = (t: number) => {
  return new Promise((r) => {
    setTimeout(r, t);
  });
};

describe("chainRoute", () => {
  it("Creates a chained route", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/");
    const routes = [
      { path: "/root(.*)", route: createRoute() },
      { path: "/root/test", route: createRoute() },
      { path: "/root/test2", route: createRoute() },
      { path: "/another", route: createRoute() },
    ];
    const chainedRoute = chainRoute({ route: routes[0].route, beforeOpen: createEffect(() => {}) });
    const router = createHistoryRouter({ routes });

    const opened = vi.fn();
    const updated = vi.fn();
    const closed = vi.fn();

    createWatch({ scope, fn: opened, unit: chainedRoute.opened });
    createWatch({ scope, fn: updated, unit: chainedRoute.updated });
    createWatch({ scope, fn: closed, unit: chainedRoute.closed });

    await allSettled(router.setHistory, { scope, params: history });

    await allSettled(routes[1].route.open, { scope });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(0);
    expect(closed).toHaveBeenCalledTimes(0);

    await allSettled(routes[2].route.open, { scope });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(0);

    await allSettled(routes[1].route.open, { scope });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(closed).toHaveBeenCalledTimes(0);

    await allSettled(routes[3].route.open, { scope });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(2);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it("Event<void> in beforeOpen with openOn, cancelOn", async () => {
    const route = createRoute();

    const sessionCheckStarted = createEvent();
    const sessionEstablished = createEvent();
    const sessionCheckFailed = createEvent();

    const authorizedRoute = chainRoute({
      route: route,
      beforeOpen: sessionCheckStarted,
      openOn: sessionEstablished,
      cancelOn: sessionCheckFailed,
    });

    sample({
      clock: sessionCheckStarted,
      target: sessionEstablished,
    });

    const history = createMemoryHistory();
    const router = createHistoryRouter({
      routes: [{ path: "/", route }],
    });
    const scope = fork();
    history.push("/");
    await allSettled(router.setHistory, { scope, params: history });

    expect(scope.getState(route.$isOpened)).toBeTruthy();
    expect(scope.getState(authorizedRoute.$isOpened)).toBeTruthy();
  });

  it("Effect in beforeOpen", async () => {
    const route = createRoute();
    const history = createMemoryHistory();
    const router = createHistoryRouter({
      routes: [{ path: "/", route }],
    });
    const cb = vi.fn((_: any) => sleep(100));
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: fx,
    });
    const scope = fork();
    history.push("/test");
    await allSettled(router.setHistory, { params: history, scope });
    const promise = allSettled(route.open, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await promise;
    expect(cb).toBeCalledTimes(1);
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it("attach-like config in beforeOpen", async () => {
    const route = createRoute<{ x: string }>();
    const router = createHistoryRouter({
      routes: [{ path: "/test/:x", route }],
    });
    const history = createMemoryHistory();
    const cb = vi.fn(async (payload: { param: string; queryParam: string }) => {
      await sleep(100);
      return payload;
    });
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: {
        effect: fx,
        mapParams: ({ params, query }) => ({
          param: params.x,
          queryParam: query.foo,
        }),
      },
    });
    const scope = fork();
    history.push("/test");
    await allSettled(router.setHistory, { params: history, scope });
    const promise = allSettled(route.navigate, {
      scope,
      params: {
        params: { x: "param" },
        query: { foo: "query" },
      },
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await promise;
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({ param: "param", queryParam: "query" });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it("openOn parameter", async () => {
    const route = createRoute<{ x: string }>();
    const history = createMemoryHistory();
    const router = createHistoryRouter({
      routes: [{ path: "/test/:x", route }],
    });
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = vi.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    const scope = fork();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: {
        replace: false,
        params: { x: "param" },
        query: { foo: "query" },
      },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      params: { x: "param" },
      query: { foo: "query" },
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(openOn, {
      scope,
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it("cancelOn parameter", async () => {
    const route = createRoute<{ x: string }>();
    const history = createMemoryHistory();
    const router = createHistoryRouter({
      routes: [{ path: "/test/:x", route }],
    });
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = vi.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    const scope = fork();
    history.push("/test");
    await allSettled(router.setHistory, { scope, params: history });
    await allSettled(route.navigate, {
      scope,
      params: {
        params: { x: "param" },
        query: { foo: "query" },
      },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      params: { x: "param" },
      query: { foo: "query" },
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(cancelOn, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(openOn, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
  });

  it("Chained route .push must trigger navigation", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/");

    const route = createRoute<{ param: string }>();

    const router = createHistoryRouter({
      routes: [{ path: "/route/:param", route }],
    });

    const beforeOpenFx = createEffect(vi.fn(() => sleep(100)));

    const chainedRoute = chainRoute({ route, beforeOpen: beforeOpenFx });

    const opened = vi.fn();
    const updated = vi.fn();
    const chainedOpened = vi.fn();
    const chainedUpdated = vi.fn();

    createWatch({ scope, fn: opened, unit: route.opened });
    createWatch({ scope, fn: updated, unit: route.updated });
    createWatch({ scope, fn: chainedOpened, unit: chainedRoute.opened });
    createWatch({ scope, fn: chainedUpdated, unit: chainedRoute.updated });

    await allSettled(router.setHistory, { scope, params: history });

    await allSettled(chainedRoute.open, { scope, params: { param: "foo" } });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(0);
    expect(chainedOpened).toHaveBeenCalledTimes(1);
    expect(chainedUpdated).toHaveBeenCalledTimes(0);

    await allSettled(chainedRoute.open, { scope, params: { param: "bar" } });
    expect(updated).toHaveBeenCalledTimes(1);
    expect(chainedUpdated).toHaveBeenCalledTimes(1);
  });

  it("Chained route .navigate must trigger navigation", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/");

    const route = createRoute<{ param: string }>();

    const router = createHistoryRouter({
      routes: [{ path: "/route/:param", route }],
    });

    const beforeOpenFx = createEffect(vi.fn(() => sleep(100)));

    const chainedRoute = chainRoute({ route, beforeOpen: beforeOpenFx });

    const opened = vi.fn();
    const updated = vi.fn();
    const chainedOpened = vi.fn();
    const chainedUpdated = vi.fn();

    createWatch({ scope, fn: opened, unit: route.opened });
    createWatch({ scope, fn: updated, unit: route.updated });
    createWatch({ scope, fn: chainedOpened, unit: chainedRoute.opened });
    createWatch({ scope, fn: chainedUpdated, unit: chainedRoute.updated });

    await allSettled(router.setHistory, { scope, params: history });

    await allSettled(chainedRoute.navigate, {
      scope,
      params: { params: { param: "foo" }, query: {} },
    });
    expect(opened).toHaveBeenCalledTimes(1);
    expect(updated).toHaveBeenCalledTimes(0);
    expect(chainedOpened).toHaveBeenCalledTimes(1);
    expect(chainedUpdated).toHaveBeenCalledTimes(0);

    await allSettled(chainedRoute.navigate, {
      scope,
      params: { params: { param: "bar" }, query: {} },
    });
    expect(updated).toHaveBeenCalledTimes(1);
    expect(chainedUpdated).toHaveBeenCalledTimes(1);
  });

  it("Multiple times chained route must triggering navigation", async () => {
    const scope = fork();
    const history = createMemoryHistory();
    history.push("/");

    const route = createRoute();

    const router = createHistoryRouter({
      routes: [{ path: "/route", route }],
    });

    const chainedRoute = chainRoute({ route, beforeOpen: createEffect(vi.fn()) });
    const doubleChainedRoute = chainRoute({
      route: chainedRoute,
      beforeOpen: createEffect(vi.fn()),
    });

    const opened = vi.fn();
    const chainedOpened = vi.fn();
    const doubleChainedOpened = vi.fn();

    createWatch({ scope, fn: opened, unit: route.opened });
    createWatch({ scope, fn: chainedOpened, unit: chainedRoute.opened });
    createWatch({ scope, fn: doubleChainedOpened, unit: doubleChainedRoute.opened });

    await allSettled(router.setHistory, { scope, params: history });

    await allSettled(doubleChainedRoute.open, { scope });

    expect(opened).toHaveBeenCalledTimes(1);
    expect(chainedOpened).toHaveBeenCalledTimes(1);
    expect(doubleChainedOpened).toHaveBeenCalledTimes(1);
  });
});
