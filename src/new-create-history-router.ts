import { History } from 'history';
import {
  sample,
  createEvent,
  createStore,
  attach,
  Unit,
  scopeBind,
} from 'effector';
import { createRouterControls } from './create-router-controls';
import {
  UnmappedRouteObject,
  RouteInstance,
  RouteQuery,
  HistoryPushParams,
  RouteObject,
  RouteParams,
} from './types';
import { remapRouteObjects } from './utils/remap-route-objects';
import { paramsEqual } from './utils/equals';
import { buildPath, matchPath } from './utils/build-path';
import { isRoute } from './utils/is-route';
import {
  historyPushFx,
  historyBackFx,
  historyForwardFx,
} from './utils/history-effects';

export const createHistoryRouter = ({
  base,
  routes,
  notFoundRoute,
  hydrate,
  controls = createRouterControls(),
}: {
  base?: string;
  routes: UnmappedRouteObject<any>[];
  notFoundRoute?: RouteInstance<any>;
  hydrate?: boolean;
  controls?: ReturnType<typeof createRouterControls>;
}) => {
  const remappedRoutes = remapRouteObjects(routes, base);

  const setHistory = createEvent<History>();
  const navigateFromRouteTriggered = createEvent<{
    route: RouteObject<any>;
    params: RouteParams;
    query: RouteQuery;
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
    opened: RecalculationResult<any>[];
    closed: RecalculationResult<any>[];
  }>();
  const routesOpened = createEvent<RecalculationResult<any>[]>();
  const routesClosed = createEvent<RecalculationResult<any>[]>();
  const routeNotFound = createEvent();
  const initialized = createEvent<{
    activeRoutes: RouteInstance<any>[];
    path: string;
    query: RouteQuery;
  }>();

  const $path = createStore('');
  const $query = createStore<RouteQuery>({});
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
    effect: historyPushFx,
    source: $history,
    mapParams: (params: Omit<HistoryPushParams, 'history'>, history) => {
      return {
        history,
        ...params,
      };
    },
  });

  const subscribeHistoryFx = attach({
    source: $history,
    effect: (history) => {
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

  // If `hydrate` flag is set,
  // don't trigger recheck on history init
  const historyUpdateTriggered = sample({
    clock: hydrate
      ? [historyUpdated]
      : [historyUpdated, subscribeHistoryFx.done],
  }) as Unit<any>;

  /// History subscription
  $history.on(setHistory, (_, history) => history);

  sample({
    clock: $history,
    target: subscribeHistoryFx,
  });

  sample({
    clock: historyUpdateTriggered,
    source: $history,
    fn: (history) => {
      const [path, query, hash] = [
        history.location.pathname,
        Object.fromEntries(
          new URLSearchParams(history.location.search)
        ) as RouteQuery,
        history.location.hash,
      ];
      return {
        path,
        query,
        hash,
      };
    },
    target: recalculateTriggered,
  });

  /// Routes updates handling
  for (const routeObj of remappedRoutes) {
    const routeStateChangeRequested = {
      opened: sample({
        clock: routesOpened.filterMap(containsCurrentRoute(routeObj)),
        filter: routeObj.route.$isOpened.map((isOpened) => !isOpened),
      }),
      updated: sample({
        clock: routesOpened.filterMap(containsCurrentRoute(routeObj)),
        filter: routeObj.route.$isOpened,
      }),
      closed: sample({
        clock: routesClosed.filterMap(containsCurrentRoute(routeObj)),
        filter: routeObj.route.$isOpened,
      }),
    };

    // Trigger .updated() for the routes marked as "opened" but already opened
    sample({
      clock: routeStateChangeRequested.updated,
      source: [routeObj.route.$params, routeObj.route.$query],
      // Skip .updated() calls if params & query are the same
      filter: ([params, query], next) => {
        return (
          !paramsEqual(params, next.params) || !paramsEqual(query, next.query)
        );
      },
      fn: (_, payload) => payload!,
      target: routeObj.route.updated,
    });

    // Trigger .opened() for the routes marked as "opened"
    sample({
      clock: routeStateChangeRequested.opened,
      // TODO: Scratch this?
      filter: $isRouteNavigateInProgress.map(
        (isOpenedManually) => !isOpenedManually
      ),
      target: routeObj.route.opened,
    });

    // Trigger .closed() for the routes marked as "closed"
    sample({
      clock: routeStateChangeRequested.closed,
      target: routeObj.route.closed,
    });
  }

  /// Handling route.navigateFx navigation
  for (const routeObj of remappedRoutes) {
    // Run "Handling route.navigateFx navigation" step
    sample({
      clock: routeObj.route.navigate.done,
      fn: ({ result: { params, query } }) => ({
        route: routeObj,
        params,
        query,
      }),
      target: navigateFromRouteTriggered,
    });
  }

  $isRouteNavigateInProgress.on(navigateFromRouteTriggered, () => true);

  sample({
    clock: navigateFromRouteTriggered,
    fn: ({ route, params, query }) => {
      const path = buildPath({
        pathCreator: route.path,
        params,
        query,
      });
      return {
        path,
        params,
        query,
        method: 'push' as const,
      };
    },
    target: pushFx,
  });

  $isRouteNavigateInProgress.reset([routesOpened, routesClosed]);

  /// Recalculation
  // Triggered on every history change + once when history instance is set
  sample({
    clock: recalculateTriggered,
    fn: ({ path, query, hash }) => {
      // WARNING: These arrays are immutable
      // But, for some reason, if we switch let->const,
      // Most of the test cases fail
      let opened = [] as RecalculationResult<any>[];
      let closed = [] as RecalculationResult<any>[];

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
          routeObj: route,
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
            (obj) => obj.routeObj.route === closed[closedIdx].routeObj.route
          )
        ) {
          // @ts-expect-error
          closed[closedIdx] = null;
        }
      }
      closed = closed.filter(Boolean);

      return {
        opened,
        closed,
        path,
        query,
      };
    },
    target: recalculated,
  });

  $path.on(recalculated, (_, { path }) => path);

  $query.on(recalculated, (_, { query }) => query);

  sample({
    clock: recalculated.map(({ opened }) => opened),
    filter: (routes) => routes.length > 0,
    target: routesOpened,
  });

  sample({
    clock: recalculated.map(({ closed }) => closed),
    filter: (routes) => routes.length > 0,
    target: routesClosed,
  });

  $activeRoutes.on(recalculated, (_, { opened }) => {
    return opened.map((recheckResult) => recheckResult.routeObj.route);
  });

  /// Handling 404
  sample({
    clock: recalculated.map(({ opened }) => opened),
    filter: (routes) => routes.length === 0,
    target: routeNotFound,
  });

  if (isRoute(notFoundRoute)) {
    sample({
      clock: routeNotFound,
      source: $query,
      filter: notFoundRoute.$isOpened.map((isOpened) => !isOpened),
      fn: (query) => ({ query, params: {} }),
      target: notFoundRoute.opened,
    });

    sample({
      clock: routeNotFound,
      source: $query,
      filter: notFoundRoute.$isOpened,
      fn: (query) => ({ query, params: {} }),
      target: notFoundRoute.updated,
    });

    sample({
      clock: recalculated.map(({ opened }) => opened.length > 0),
      filter: notFoundRoute.$isOpened,
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
    target: controls.$query,
  });

  sample({
    clock: controls.$query,
    source: { path: $path },
    filter: $isRouteNavigateInProgress.map(
      (isRouteNavigateInProgress) => !isRouteNavigateInProgress
    ),
    fn: ({ path }, query) => {
      const qs = new URLSearchParams(query);
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
    filter: $isFirstCheckPassed.map(
      (isFirstCheckPassed) => !isFirstCheckPassed
    ),
    source: {
      activeRoutes: $activeRoutes,
      path: $path,
      query: $query,
    },
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
};

type RecalculationResult<Params extends RouteParams> = {
  routeObj: RouteObject<Params>;
  params: Params;
  query: RouteQuery;
};

const containsCurrentRoute =
  (routeObj: RouteObject<any>) =>
  (recheckResults: RecalculationResult<any>[]) => {
    const result = recheckResults.find(
      (recheckResult) => recheckResult.routeObj.route === routeObj.route
    );
    if (!result) {
      return;
    }
    return {
      params: result.params,
      query: result.query,
    };
  };
