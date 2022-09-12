import { History } from 'history';
import { attach, createEvent, createStore, sample, scopeBind } from 'effector';
import { createRouterControls } from './create-router-controls';
import {
  HistoryPushParams,
  ParamsSerializer,
  RouteInstance,
  RouteObject,
  RouteParams,
  RouteQuery,
  UnmappedRouteObject,
} from '../types';
import { remapRouteObjects } from '../utils/remap-route-objects';
import { paramsEqual } from '../utils/equals';
import { buildPath, matchPath } from '../utils/build-path';
import { isRoute } from './is-route';
import {
  historyBackFx,
  historyForwardFx,
  historyPushFx,
} from '../utils/history-effects';
import { not } from '../utils/logic';

export function createHistoryRouter({
  base,
  routes,
  notFoundRoute,
  hydrate,
  serialize,
  controls = createRouterControls(),
}: {
  base?: string;
  routes: UnmappedRouteObject<any>[];
  notFoundRoute?: RouteInstance<any>;
  serialize?: ParamsSerializer;
  hydrate?: boolean;
  controls?: ReturnType<typeof createRouterControls>;
}) {
  const remappedRoutes = remapRouteObjects(routes, base);

  const setHistory = createEvent<History>();
  const navigateFromRouteTriggered = createEvent<{
    route: RouteObject<any>;
    params: RouteParams;
    query: RouteQuery;
    replace: boolean;
  }>();
  const historyUpdated = createEvent();
  const recalculateTriggered = createEvent<{
    path: string;
    query: RouteQuery;
    hash: string;
  }>();
  const recalculated = createEvent<{
    path: string;
    query: RouteQuery;
    matching: RecalculationResult<any>[];
    mismatching: RecalculationResult<any>[];
  }>();
  const routesMatched = createEvent<RecalculationResult<any>[]>();
  const routesMismatched = createEvent<RecalculationResult<any>[]>();
  const routeNotFound = createEvent();
  const initialized = createEvent<{
    activeRoutes: RouteInstance<any>[];
    path: string;
    query: RouteQuery;
  }>();

  const $path = createStore('');
  const $query = createStore<RouteQuery>(
    {},
    {
      name: 'historyRouter.$query',
      updateFilter: (newQuery, oldQuery) => !paramsEqual(newQuery, oldQuery),
    }
  );
  const $activeRoutes = createStore<RouteInstance<any>[]>([], {
    serialize: 'ignore',
  });
  // @ts-expect-error
  const $history = createStore<History>(null, {
    serialize: 'ignore',
  });
  const $isFirstCheckPassed = createStore(false);
  const $isRouteNavigateInProgress = createStore(false);

  const pushFx = attach({
    source: $history,
    effect(history, params: Omit<HistoryPushParams, 'history'>) {
      return historyPushFx({
        history,
        ...params,
      });
    },
  });

  const subscribeHistoryFx = attach({
    source: $history,
    effect(history) {
      let scopedHistoryUpdated = historyUpdated;
      try {
        // @ts-expect-error
        scopedHistoryUpdated = scopeBind(historyUpdated);
      } catch (err) {
        console.log(err);
      }
      history.listen(() => {
        scopedHistoryUpdated();
      });
      return true;
    },
  });

  const historyUpdatedParsed = sample({
    clock: hydrate
      ? [historyUpdated]
      : [historyUpdated, subscribeHistoryFx.done],
    source: $history,
    fn: (history) => ({
      path: history?.location.pathname ?? '',
      query:
        serialize?.read(history?.location.search ?? '') ??
        Object.fromEntries(new URLSearchParams(history?.location.search)),
    }),
  });

  // If `hydrate` flag is set,
  // don't trigger recheck on history init
  const historyUpdateTriggered = sample({
    clock: historyUpdatedParsed,
    source: {
      path: $path,
      query: $query,
    },
    filter: ({ path: savedPath, query: savedQuery }, history) =>
      history.path !== savedPath || !paramsEqual(history.query, savedQuery),
    fn: (_, history) => history,
  });

  /// History subscription
  $history.on(setHistory, (_, history) => history);

  sample({
    clock: $history,
    target: subscribeHistoryFx,
  });

  sample({
    clock: historyUpdateTriggered,
    source: $history,
    fn(history) {
      const path = history.location.pathname;
      const hash = history.location.hash;
      const query: RouteQuery =
        serialize?.read(history.location.search) ??
        Object.fromEntries(new URLSearchParams(history.location.search));
      return { path, query, hash };
    },
    target: recalculateTriggered,
  });

  /// Routes updates handling
  for (const routeObj of remappedRoutes) {
    const currentRouteMatched = routesMatched.filterMap(
      containsCurrentRoute(routeObj)
    );
    const currentRouteMismatched = routesMismatched.filterMap(
      containsCurrentRoute(routeObj)
    );
    const routeStateChangeRequested = {
      opened: sample({
        clock: currentRouteMatched,
        filter: not(routeObj.route.$isOpened),
      }),
      updated: sample({
        clock: currentRouteMatched,
        filter: routeObj.route.$isOpened,
      }),
      closed: sample({
        clock: currentRouteMismatched,
        filter: routeObj.route.$isOpened,
      }),
    };

    // Trigger .updated() for the routes marked as "matched" but already opened
    sample({
      clock: routeStateChangeRequested.updated,
      source: [routeObj.route.$params, routeObj.route.$query],
      // Skip .updated() calls if params & query are the same
      filter: ([params, query], next) =>
        !paramsEqual(params, next.params) || !paramsEqual(query, next.query),
      fn: (_, paramsAndQuery) => paramsAndQuery,
      target: routeObj.route.updated,
    });

    // Trigger .opened() for the routes marked as "matched" but not opened yet
    sample({
      clock: routeStateChangeRequested.opened,
      // TODO: Scratch this?
      filter: not($isRouteNavigateInProgress),
      target: routeObj.route.opened,
    });

    // Trigger .closed() for the routes marked as "mismatched" but opened
    sample({
      clock: routeStateChangeRequested.closed,
      target: routeObj.route.closed,
    });
  }

  /// Handling route.navigateFx navigation
  for (const routeObj of remappedRoutes) {
    // Run "Handling route.navigateFx navigation" step
    sample({
      clock: routeObj.route.navigate.doneData,
      fn: ({ params, query, replace }) => ({
        route: routeObj,
        params,
        query,
        replace: replace ?? false,
      }),
      target: navigateFromRouteTriggered,
    });
  }

  $isRouteNavigateInProgress.on(navigateFromRouteTriggered, () => true);

  sample({
    clock: navigateFromRouteTriggered,
    fn({ route, params, query, replace }) {
      const path = buildPath({
        pathCreator: route.path,
        params,
        query,
        serialize,
      });
      const method: 'replace' | 'push' = replace ? 'replace' : 'push';
      return {
        path,
        params,
        query,
        method,
      };
    },
    target: pushFx,
  });

  $isRouteNavigateInProgress.reset([routesMatched, routesMismatched]);

  /// Recalculation
  // Triggered on every history change + once when history instance is set
  sample({
    clock: recalculateTriggered,
    fn({ path, query, hash }) {
      const matchingRoutes = [] as RecalculationResult<any>[];
      const mismatchingRoutes = [] as RecalculationResult<any>[];

      for (const route of remappedRoutes) {
        // NOTE: Use hash string as well if route.path contains #
        const actualPath = route.path.includes('#')
          ? `${path}${hash}`
          : `${path}`;
        const { matches, params } = matchPath({
          pathCreator: route.path,
          actualPath,
        });

        const suitableRoutes = matches ? matchingRoutes : mismatchingRoutes;
        suitableRoutes.push({
          routeObj: route,
          params,
          query,
        });
      }

      // Checking for routes we need to close
      // Remove all that are marked to be opened
      mismatchingRoutes.forEach((mismatchedRoute, mismatchedIndex) => {
        const mismatchedRouteExistsInMatchedList = matchingRoutes.some(
          (matchedRoute) =>
            matchedRoute.routeObj.route === mismatchedRoute.routeObj.route
        );
        if (mismatchedRouteExistsInMatchedList) {
          mismatchingRoutes.splice(mismatchedIndex, 1);
        }
      });

      return {
        matching: matchingRoutes,
        mismatching: mismatchingRoutes.filter(Boolean),
        path,
        query,
      };
    },
    target: recalculated,
  });

  $path.on(historyUpdateTriggered, (_, { path }) => path);

  $query.on(historyUpdateTriggered, (_, { query }) => query);

  const matchingRecalculated = recalculated.map(({ matching }) => matching);

  sample({
    clock: matchingRecalculated,
    filter: (routes) => routes.length > 0,
    target: routesMatched,
  });

  sample({
    clock: recalculated.map(({ mismatching }) => mismatching),
    filter: (routes) => routes.length > 0,
    target: routesMismatched,
  });

  $activeRoutes.on(recalculated, (_, { matching }) =>
    matching.map((recheckResult) => recheckResult.routeObj.route)
  );

  /// Handling 404
  sample({
    clock: matchingRecalculated,
    filter: (routes) => routes.length === 0,
    target: routeNotFound,
  });

  if (isRoute(notFoundRoute)) {
    sample({
      clock: routeNotFound,
      source: $query,
      filter: notFoundRoute.$isOpened,
      fn: (query) => ({ query, params: {} }),
      target: notFoundRoute.updated,
    });

    sample({
      clock: routeNotFound,
      source: { query: $query, isOpened: notFoundRoute.$isOpened },
      filter: ({ isOpened }) => !isOpened,
      fn: ({ query }) => ({ query, params: {} }),
      target: notFoundRoute.opened,
    });

    sample({
      clock: matchingRecalculated,
      source: notFoundRoute.$isOpened,
      filter: (isOpened, matching) => isOpened && matching.length > 0,
      target: notFoundRoute.closed,
    });
  }

  /// Back/forward navigation
  sample({
    clock: controls.back,
    source: $history,
    target: historyBackFx,
  });

  sample({
    clock: controls.forward,
    source: $history,
    target: historyForwardFx,
  });

  /// Query syncing
  sample({
    clock: $query,
    source: { controlsQuery: controls.$query, localQuery: $query },
    filter: ({ controlsQuery, localQuery }) =>
      !paramsEqual(controlsQuery, localQuery),
    fn: ({ localQuery }) => localQuery,
    target: controls.$query,
  });

  sample({
    clock: controls.$query,
    source: {
      path: $path,
      localQuery: $query,
      isNavigateInProgress: $isRouteNavigateInProgress,
      realHistory: $history,
    },
    filter: ({ localQuery, isNavigateInProgress, realHistory }, query) => {
      const realQuery =
        serialize?.read(realHistory.location.search) ??
        Object.fromEntries(new URLSearchParams(realHistory.location.search));
      return (
        isNavigateInProgress ||
        !paramsEqual(query, realQuery) ||
        !paramsEqual(localQuery, query)
      );
    },
    fn({ path }, query) {
      const qs = serialize?.write(query) ?? new URLSearchParams(query);
      return {
        path: `${path}${qs ? `?${qs}` : ''}`,
        params: {},
        query: query,
        method: 'push' as const,
      };
    },
    target: pushFx,
  });

  /// Initialization
  sample({
    clock: recalculated,
    source: {
      activeRoutes: $activeRoutes,
      path: $path,
      query: $query,
    },
    filter: $isFirstCheckPassed.map(
      (isFirstCheckPassed) => !isFirstCheckPassed
    ),
    target: initialized,
  });

  $isFirstCheckPassed.on(initialized, () => true).reset($history);

  return {
    $path,
    $activeRoutes,
    $history,
    setHistory,
    $query: $query,
    back: controls.back,
    forward: controls.forward,
    push: pushFx,
    routes: remappedRoutes,
    initialized,
    routeNotFound,
  };
}

type RecalculationResult<Params extends RouteParams> = {
  routeObj: RouteObject<Params>;
  params: Params;
  query: RouteQuery;
};

const containsCurrentRoute =
  (routeObj: RouteObject<any>) =>
  (recheckResults: RecalculationResult<any>[]) => {
    const recheck = recheckResults.find(
      (recheckResult) => recheckResult.routeObj.route === routeObj.route
    );
    if (!recheck) {
      return;
    }
    return {
      params: recheck.params,
      query: recheck.query,
    };
  };
