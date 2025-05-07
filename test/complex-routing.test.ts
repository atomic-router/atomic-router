import { allSettled, fork } from "effector";
import { createMemoryHistory } from "history";
import { describe, expect, it } from "vitest";

import { type UnmappedRouteObject, createHistoryRouter, createRoute } from "../src";

describe("multiple routing groups", () => {
  it("Provider not handle routesmap when routes included more 2 routes #91", async () => {
    const routes = {
      home: createRoute(),
      first: {
        main: createRoute(),
        list: createRoute<{ id: string }>(),
        edit: createRoute<{ id: string; subId: string }>(),
        create: createRoute<{ id: string }>(),
      },
    };

    const navGroups = {
      first: createRoute<{ id?: string; subId?: string }>(),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routesMap: UnmappedRouteObject<any>[] = [
      { path: "/", route: routes.home },
      {
        path: "/first/:id",
        route: [routes.first.list, navGroups.first],
      },
      {
        path: "/first/:id/create",
        route: [navGroups.first, routes.first.main, routes.first.create],
      },

      {
        path: "/first/:id/:subId((?!create)[0-9]+)",
        route: [routes.first.edit, routes.first.main, navGroups.first],
      },
    ];

    const router = createHistoryRouter({
      routes: routesMap,
    });

    const scope = fork();
    const history = createMemoryHistory({
      initialEntries: ["/"],
    });

    await allSettled(router.setHistory, { scope, params: history });

    expect(scope.getState(routes.home.$isOpened)).toBeTruthy();
    expect(scope.getState(routes.first.main.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.list.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.edit.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.create.$isOpened)).toBeFalsy();
    expect(scope.getState(navGroups.first.$isOpened)).toBeFalsy();

    await allSettled(routes.first.list.navigate, {
      scope,
      params: { params: { id: "1" }, query: {} },
    });
    expect(scope.getState(routes.first.list.$isOpened)).toBeTruthy();
    expect(scope.getState(navGroups.first.$isOpened)).toBeTruthy();
    expect(scope.getState(routes.home.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.main.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.edit.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.create.$isOpened)).toBeFalsy();

    await allSettled(routes.first.create.navigate, {
      scope,
      params: { params: { id: "1" }, query: {} },
    });
    expect(scope.getState(routes.first.create.$isOpened)).toBeTruthy();
    expect(scope.getState(navGroups.first.$isOpened)).toBeTruthy();
    expect(scope.getState(routes.home.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.main.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.edit.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.list.$isOpened)).toBeFalsy();

    await allSettled(routes.home.navigate, {
      scope,
      params: { params: {}, query: {} },
    });
    expect(scope.getState(routes.home.$isOpened)).toBeTruthy();
    expect(scope.getState(routes.first.main.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.list.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.edit.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.create.$isOpened)).toBeFalsy();
    expect(scope.getState(navGroups.first.$isOpened)).toBeFalsy();

    await allSettled(routes.first.edit.navigate, {
      scope,
      params: { params: { id: "1", subId: "2" }, query: {} },
    });
    expect(scope.getState(routes.first.edit.$isOpened)).toBeTruthy();
    expect(scope.getState(navGroups.first.$isOpened)).toBeTruthy();
    expect(scope.getState(routes.home.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.main.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.create.$isOpened)).toBeFalsy();
    expect(scope.getState(routes.first.list.$isOpened)).toBeFalsy();
  });
});
