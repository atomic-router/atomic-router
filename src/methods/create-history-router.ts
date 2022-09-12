import { buildPath, matchPath } from '../utils/build-path';
import { History } from 'history';
import {
  ParamsSerializer,
  RouteInstance,
  RouteParams,
  RouteQuery,
} from '../types';
import {
  attach,
  createEffect,
  createEvent,
  createStore,
  guard,
  restore,
  sample,
  scopeBind,
} from 'effector';
import { paramsEqual } from '../utils/equals';
import { isRoute } from './is-route';

type RouteObject<Params extends RouteParams> = {
  route: RouteInstance<Params>;
  path: string;
};

type UnmappedRouteObject<Params extends RouteParams> = {
  route: RouteInstance<Params> | RouteInstance<Params>[];
  path: string;
};

type HistoryPushParams = {
  history: History;
  path: string;
  params: RouteParams;
  query: RouteQuery;
  method: 'replace' | 'push';
};

const historyPushFx = createEffect<HistoryPushParams, HistoryPushParams>(
  (pushParams) => {
    if (!pushParams.history) {
      throw new Error('[Routing] No history provided');
    }
    pushParams.history[pushParams.method](pushParams.path, {});
    return pushParams;
  }
);

const remapRouteObjects = (
  objects: UnmappedRouteObject<any>[],
  basePath: string = ''
) => {
  let next: RouteObject<any>[] = [];
  for (const routeObj of objects) {
    if (Array.isArray(routeObj.route)) {
      next.push(...routeObj.route.map((route) => ({ ...routeObj, route })));
    } else {
      // @ts-expect-error
      next.push(routeObj);
    }
  }
  next = next.map((routeObj) => ({
    ...routeObj,
    path: `${basePath}${routeObj.path}`,
  }));
  const derivedRoutes: RouteObject<any>[] = [];
  const nonDerivedRoutes: RouteObject<any>[] = [];
  for (const routeObj of next) {
    // @ts-expect-error Internals
    if (routeObj.route.settings.derived) {
      derivedRoutes.push(routeObj);
    } else {
      nonDerivedRoutes.push(routeObj);
    }
  }
  if (derivedRoutes.length) {
    for (const derivedRoute of derivedRoutes) {
      console.error(
        `createHistoryRouter: ${derivedRoute.path} uses derived route. This won't work`
      );
    }
  }
  return nonDerivedRoutes;
};

export const createHistoryRouter = (params: {
  base?: string;
  routes: UnmappedRouteObject<any>[];
  notFoundRoute?: RouteInstance<any>;
  hydrate?: boolean;
  serialize?: ParamsSerializer;
}) => {
  type PushParams = Omit<HistoryPushParams, 'history'>;
  type EnterParams<Params extends RouteParams> = {
    route: RouteObject<Params>;
    params: Params;
    query: RouteQuery;
    replace: boolean;
  };
  type RecheckResult<Params extends RouteParams> = {
    route: RouteObject<Params>;
    params: Params;
    query: RouteQuery;
  };

  const serialize = params.serialize;

  const remappedRoutes = remapRouteObjects(params.routes, params.base);

  const setHistory = createEvent<History>();
  const routeNotFound = createEvent();

  const $query = createStore({});
  const $path = createStore('');
  const $activeRoutes = createStore<RouteInstance<any>[]>([], {
    serialize: 'ignore',
  });
  const $isFirstCheckPassed = createStore(false);

  // @ts-expect-error
  const $history = createStore<History>(null, {
    serialize: 'ignore',
  });

  $history.on(setHistory, (_, nextHistory) => nextHistory);

  // historyPushFx for the current history
  const pushFx = attach({
    source: {
      history: $history,
    },
    effect: historyPushFx,
    mapParams: (params: PushParams, { history }) => {
      return {
        history,
        ...params,
      };
    },
  });

  // Triggered whenever some route.navigate.doneData is triggered
  const openedFx = createEffect<EnterParams<any>, PushParams>(
    ({ route, params, query, replace }) => {
      const path = buildPath({
        pathCreator: route.path,
        params,
        query,
        serialize,
      });
      return {
        path,
        params,
        query,
        method: replace ? 'replace' : 'push',
      };
    }
  );

  type RecalculateParams = {
    path: string;
    query: RouteQuery;
    hash: string;
  };
  type RecalculateResult = {
    opened: RecheckResult<any>[];
    closed: RecheckResult<any>[];
  };

  // Recalculate opened/closed routes
  const recalculateFx = createEffect<RecalculateParams, RecalculateResult>(
    ({ path, query, hash }) => {
      let opened = [] as RecheckResult<any>[];
      let closed = [] as RecheckResult<any>[];

      for (const route of remappedRoutes) {
        // NOTE: Use hash string as well if route.path contains #
        const actualPath = route.path.includes('#')
          ? `${path}${hash}`
          : `${path}`;
        const { matches, params } = matchPath({
          pathCreator: `${route.path}`,
          actualPath: actualPath,
        });
        (matches ? opened : closed).push({
          route,
          params,
          query,
        });
      }

      // Checking for routes we need to close
      // Remove all that are marked to be opened
      for (const idx in closed) {
        // @ts-expect-error
        const closedIdx = idx as number;
        if (
          opened.some(
            (obj) => obj.route.route === closed[closedIdx].route.route
          )
        ) {
          // @ts-expect-error
          closed[closedIdx] = null;
        }
      }
      closed = closed.filter(Boolean);

      return { opened, closed };
    }
  );

  $path.on(recalculateFx.done, (_, { params: { path } }) => path);

  $query.on(recalculateFx.done, (_, { params: { query } }) => query);

  $activeRoutes.on(recalculateFx.doneData, (_, { opened }) =>
    opened.map((recheckResult) => recheckResult.route.route)
  );

  sample({
    clock: openedFx.doneData,
    target: pushFx,
  });

  // sample({
  //   clock: pushFx.doneData,
  //   target: recalculateFx,
  // });

  // Trigger 404 if no routes were opened
  guard({
    clock: recalculateFx.doneData,
    filter: ({ opened }) => opened.length === 0,
    target: routeNotFound,
  });

  const routesOpened = recalculateFx.doneData.map(({ opened }) => opened);
  const routesClosed = recalculateFx.doneData.map(({ closed }) => closed);

  for (const routeObj of remappedRoutes) {
    const $isOpenedManually = createStore(false);

    // Watch for route.navigate.doneData to build new path and push
    const navigatedManually = routeObj.route.navigate.done;

    sample({
      clock: navigatedManually,
      fn: ({ params: { replace }, result: { params, query } }) => ({
        route: routeObj,
        params,
        query,
        replace: replace ?? false,
      }),
      target: openedFx,
    });

    const containsCurrentRoute = <T extends RouteParams>(
      recheckResults: RecheckResult<T>[]
    ) => {
      const foundRoute = recheckResults.find(
        (recheckResult) => recheckResult.route.route === routeObj.route
      );
      if (!foundRoute) {
        return;
      }
      return {
        params: foundRoute.params,
        query: foundRoute.query,
      };
    };

    const recheckLifecycle = {
      opened: guard({
        clock: routesOpened.filterMap(containsCurrentRoute),
        filter: routeObj.route.$isOpened.map((isOpened) => !isOpened),
      }),
      updated: guard({
        clock: routesOpened.filterMap(containsCurrentRoute),
        filter: routeObj.route.$isOpened,
      }),
      closed: guard({
        clock: routesClosed.filterMap(containsCurrentRoute),
        filter: routeObj.route.$isOpened,
      }),
    };

    // This is needed to skip extra opened/udpated calls from the route itself
    $isOpenedManually.on(navigatedManually, () => true);

    // Trigger .updated() for already opened routes marked as "opened"
    const updated = guard({
      clock: recheckLifecycle.updated,
      filter: $isOpenedManually.map((isOpenedManually) => !isOpenedManually),
    });

    sample({
      source: restore(updated, null),
      clock: guard({
        clock: updated,
        source: [routeObj.route.$params, routeObj.route.$query],
        // Skip .updated() calls if params & query are the same
        filter([params, query], next) {
          return (
            !paramsEqual(params, next.params) || !paramsEqual(query, next.query)
          );
        },
      }),
      fn: (payload) => payload!,
      target: routeObj.route.updated,
    });

    // Trigger .opened() for the routes marked as "opened"
    guard({
      clock: recheckLifecycle.opened,
      filter: $isOpenedManually.map((isOpenedManually) => !isOpenedManually),
      target: routeObj.route.opened,
    });

    // Trigger .closed() for the routes marked as "closed"
    sample({
      clock: recheckLifecycle.closed,
      target: routeObj.route.closed,
    });

    // Reset $isOpenedManually
    $isOpenedManually.reset(sample({ clock: routesOpened }));
  }

  if (isRoute(params.notFoundRoute)) {
    const notFoundRouteTriggered = sample({
      clock: $activeRoutes,
      source: params.notFoundRoute.$isOpened,
      fn: (isOpened, activeRoutes) => ({
        isOpened,
        activeRoutesCount: activeRoutes.length,
      }),
    });

    sample({
      clock: notFoundRouteTriggered,
      source: { query: $query },
      filter: (_, { activeRoutesCount, isOpened }) =>
        !isOpened && activeRoutesCount === 0,
      fn: ({ query }) => ({ query, params: {} }),
      target: params.notFoundRoute.opened,
    });

    sample({
      clock: notFoundRouteTriggered,
      source: { query: $query },
      filter: (_, { activeRoutesCount, isOpened }) =>
        isOpened && activeRoutesCount === 0,
      fn: ({ query }) => ({ query, params: {} }),
      target: params.notFoundRoute.updated,
    });

    sample({
      clock: notFoundRouteTriggered,
      filter: ({ activeRoutesCount, isOpened }) =>
        isOpened && activeRoutesCount !== 0,
      target: params.notFoundRoute.closed,
    });
  }

  // Takes current path from history and triggers recalculate
  // Triggered on every history change + once when history instance is set
  const recheckFx = attach({
    source: $history,
    effect(history) {
      const path = history.location.pathname;
      const hash = history.location.hash;
      const query: RouteQuery =
        serialize?.read(history.location.search) ??
        Object.fromEntries(new URLSearchParams(history.location.search));

      return { path, query, hash };
    },
  });

  sample({
    source: recheckFx.doneData,
    target: recalculateFx,
  });

  // Triggered whenever history instance is set
  const subscribeHistoryFx = attach({
    source: $history,
    effect(history) {
      let scopedRecheck = recheckFx;
      try {
        // @ts-expect-error
        scopedRecheck = scopeBind(recheckFx);
      } catch (err) {}
      history.listen(() => {
        scopedRecheck();
      });
      return true;
    },
  });

  // If `hydrate` flag is set,
  // don't trigger recheck on history init
  if (!params.hydrate) {
    sample({
      clock: subscribeHistoryFx.doneData,
      target: recheckFx,
    });
  }

  sample({
    clock: $history,
    target: subscribeHistoryFx,
  });

  $isFirstCheckPassed.on(recalculateFx.doneData, () => true).reset($history);

  const initialized = sample({
    clock: guard({
      clock: $isFirstCheckPassed,
      filter: Boolean,
    }),
    source: { activeRoutes: $activeRoutes, path: $path, query: $query },
  });

  return {
    $path,
    $query,
    $activeRoutes,
    $history,
    setHistory,
    push: pushFx,
    routes: remappedRoutes,
    initialized,
    routeNotFound,
  };
};
