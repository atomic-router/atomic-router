import { buildPath, matchPath } from './utils/build-path';
import { History } from 'history';
import { RouteInstance, RouteParams, RouteQuery } from './types';
import {
  attach,
  createEffect,
  guard,
  sample,
  createStore,
  createEvent,
  scopeBind,
  restore,
} from 'effector';
import { equals } from './utils/equals';

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
  pushParams => {
    if (!pushParams.history) {
      throw new Error('[Routing] No history provided');
    }
    pushParams.history[pushParams.method](pushParams.path, {});
    return pushParams;
  }
);

const remapRouteObjects = (objects: UnmappedRouteObject<any>[]) => {
  const next = [] as RouteObject<any>[];
  for (const routeObj of objects) {
    if (Array.isArray(routeObj.route)) {
      next.push(...routeObj.route.map(route => ({ ...routeObj, route })));
    } else {
      // @ts-expect-error
      next.push(routeObj);
    }
  }
  return next;
};

export const createHistoryRouter = (params: {
  routes: UnmappedRouteObject<any>[];
  hydrate?: boolean;
}) => {
  type PushParams = Omit<HistoryPushParams, 'history'>;
  type EnterParams<Params extends RouteParams> = {
    route: RouteObject<Params>;
    params: Params;
    query: RouteQuery;
  };
  type RecheckResult<Params extends RouteParams> = {
    route: RouteObject<Params>;
    params: Params;
    query: RouteQuery;
  };

  const remappedRoutes = remapRouteObjects(params.routes);

  const setHistory = createEvent<History>();
  const routeNotFound = createEvent();

  const $query = createStore({});
  const $path = createStore('');
  const $activeRoutes = createStore<RouteInstance<any>[]>([], {
    serialize: 'ignore',
  });

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
    ({ route, params, query }) => {
      const path = buildPath({
        pathCreator: route.path,
        params,
        query,
      });
      return {
        path,
        params,
        query,
        method: 'push',
      };
    }
  );

  // Recalculate opened/closed routes
  const recalculateFx = createEffect<
    {
      path: string;
      query: RouteQuery;
    },
    {
      opened: RecheckResult<any>[];
      closed: RecheckResult<any>[];
    }
  >(({ path, query }) => {
    const opened = [] as RecheckResult<any>[];
    const closed = [] as RecheckResult<any>[];

    for (const route of remappedRoutes) {
      const { matches, params } = matchPath({
        pathCreator: route.path,
        actualPath: path,
      });
      (matches ? opened : closed).push({
        route,
        params,
        query,
      });
    }

    return {
      opened,
      closed,
    };
  });

  $path.on(recalculateFx.done, (_prev, { params: { path } }) => path);

  $query.on(recalculateFx.done, (_prev, { params: { query } }) => query);

  $activeRoutes.on(recalculateFx.doneData, (_prev, { opened }) =>
    opened.map(recheckResult => recheckResult.route.route)
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
      fn: ({ result: { params, query } }) => ({
        route: routeObj,
        params,
        query,
      }),
      target: openedFx,
    });

    const containsCurrentRoute = (recheckResults: RecheckResult<any>[]) => {
      return recheckResults.find(
        recheckResult => recheckResult.route === routeObj
      );
    };

    const recheckLifecycle = {
      opened: guard({
        clock: routesOpened.filterMap(containsCurrentRoute),
        filter: routeObj.route.$isOpened.map(isOpened => !isOpened),
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
      filter: $isOpenedManually.map(isOpenedManually => !isOpenedManually),
    });

    sample({
      source: restore(updated, null),
      clock: guard({
        clock: updated,
        source: [routeObj.route.$params, routeObj.route.$query],
        // Skip .updated() calls if params & query are the same
        filter: ([params, query], next) => {
          return !equals(params, next.params) || !equals(query, next.query);
        },
      }),
      fn: payload => payload!,
      target: routeObj.route.updated,
    });

    // Trigger .opened() for the routes marked as "opened"
    guard({
      clock: recheckLifecycle.opened,
      filter: $isOpenedManually.map(isOpenedManually => !isOpenedManually),
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

  // Takes current path from history and triggers recalculate
  // Triggered on every history change + once when history instance is set
  const recheckFx = attach({
    source: {
      history: $history,
    },
    effect: async ({ history }) => {
      const [path, query] = [
        history.location.pathname,
        Object.fromEntries(
          // @ts-expect-error
          new URLSearchParams(history.location.search)
        ) as RouteQuery,
      ];
      return {
        path,
        query,
      };
    },
  });

  sample({
    source: recheckFx.doneData,
    target: recalculateFx,
  });

  // Triggered whenever history instance is set
  const subscribeHistoryFx = attach({
    source: {
      history: $history,
    },
    effect: async ({ history }) => {
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

  return {
    $path,
    $query,
    $activeRoutes,
    $history,
    setHistory,
    push: pushFx,
    routes: remappedRoutes,
    routeNotFound,
  };
};
