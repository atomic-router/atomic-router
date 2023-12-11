import { createMemoryHistory } from "history";
import { allSettled, fork, Store, Event } from "effector";
import { describe, it, vi, expect, Mock } from "vitest";
import { createHistoryRouter, createRoute } from "../src";

const firstRoute = createRoute();
const secondRoute = createRoute();
const notFoundRoute = createRoute();

const router = createHistoryRouter({
  routes: [
    { route: firstRoute, path: "/" },
    { route: secondRoute, path: "/second" },
  ],
  notFoundRoute,
});

describe("routeNotFound event", () => {
  it('Triggers router.routeNotFound event if initialized with "not found"', async () => {
    const routeNotFound = watch(router.routeNotFound);
    const history = createMemoryHistory();
    history.push("/not-found");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(routeNotFound).toBeCalledTimes(1);
  });

  it('Triggers router.routeNotFound event if route is changed to "not found"', async () => {
    const routeNotFound = watch(router.routeNotFound);
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    expect(routeNotFound).toBeCalledTimes(0);
    await history.push("/not-found");
    expect(routeNotFound).toBeCalledTimes(1);
  });
});

describe("notFoundRoute", () => {
  it("matches not found route if really not found", async () => {
    const history = createMemoryHistory();
    history.push("/");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    expect(scope.getState(firstRoute.$isOpened)).toBe(true);
    expect(scope.getState(secondRoute.$isOpened)).toBe(false);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(false);

    await history.push("/second");
    expect(scope.getState(firstRoute.$isOpened)).toBe(false);
    expect(scope.getState(secondRoute.$isOpened)).toBe(true);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(false);

    await history.push("/not-really-found-route-check-it-path");
    expect(scope.getState(firstRoute.$isOpened)).toBe(false);
    expect(scope.getState(secondRoute.$isOpened)).toBe(false);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(true);
  });

  it("passes query params into not found route", async () => {
    const history = createMemoryHistory();
    history.push("/really-not-found?first=1");
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    expect(scope.getState(notFoundRoute.$query)).toEqual({ first: "1" });

    await history.push("/really-not-found?second=2");
    expect(scope.getState(notFoundRoute.$query)).toEqual({ second: "2" });
  });
});

function watch<T>(unit: Store<T> | Event<T>): Mock {
  const fn = vi.fn();
  unit.watch(fn);
  return fn;
}
