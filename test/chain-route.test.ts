import { allSettled, createEffect, createEvent, createWatch, fork } from "effector";
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
    const route = createRoute();
    const history = createMemoryHistory();
    const router = createHistoryRouter({
      routes: [{ path: "/", route }],
    });
    const chainedRoute = chainRoute(route);
    const scope = fork();
    history.push("/test");
    await allSettled(router.setHistory, { params: history, scope });
    await allSettled(route.open, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
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
});
