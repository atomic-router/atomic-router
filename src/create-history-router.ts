import { buildPath, matchPath } from './build-path';
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
} from 'effector';

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
  const $activeRoutes = createStore<RouteInstance<any>[]>([]);

  // @ts-expect-error
  const $history = createStore<History>(null, {
    serialize: 'ignore',
  }).on(setHistory, (_, nextHistory) => nextHistory);

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

  // Triggered whenever some route.open.doneData is triggered
  const enteredFx = createEffect<EnterParams<any>, PushParams>(
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

  // Recalculate entered/left routes
  const recalculateFx = createEffect<
    {
      path: string;
      query: RouteQuery;
    },
    {
      entered: RecheckResult<any>[];
      left: RecheckResult<any>[];
    }
  >(({ path, query }) => {
    const entered = [] as RecheckResult<any>[];
    const left = [] as RecheckResult<any>[];

    for (const route of remappedRoutes) {
      const { matches, params } = matchPath({
        pathCreator: route.path,
        actualPath: path,
      });
      (matches ? entered : left).push({
        route,
        params,
        query,
      });
    }

    return {
      entered,
      left,
    };
  });

  $path.on(recalculateFx.done, (_prev, { params: { path } }) => path);

  $query.on(recalculateFx.done, (_prev, { params: { query } }) => query);

  $activeRoutes.on(recalculateFx.doneData, (_prev, { entered }) =>
    entered.map(recheckResult => recheckResult.route.route)
  );

  sample({
    clock: enteredFx.doneData,
    target: pushFx,
  });

  sample({
    clock: pushFx.doneData,
    target: recalculateFx,
  });

  // Trigger 404 if no routes were entered
  guard({
    clock: recalculateFx.doneData,
    filter: ({ entered }) => entered.length === 0,
    target: routeNotFound,
  });

  const routesEntered = recalculateFx.doneData.map(({ entered }) => entered);
  const routesLeft = recalculateFx.doneData.map(({ left }) => left);

  for (const routeObj of remappedRoutes) {
    // Watch for route.open.doneData to build new path and push
    sample({
      clock: routeObj.route.navigate.doneData,
      fn: ({ params, query }) => ({
        route: routeObj,
        params,
        query,
      }),
      target: enteredFx,
    });

    // Trigger .updated() for already opened routes marked as "opened"
    guard({
      clock: routesEntered.filterMap(recheckResults => {
        return recheckResults.find(
          recheckResult => recheckResult.route === routeObj
        );
      }),
      filter: routeObj.route.$isOpened.map(isOpened => isOpened),
      target: routeObj.route.updated,
    });

    // Trigger .opened() for the routes marked as "opened"
    guard({
      clock: routesEntered.filterMap(recheckResults => {
        return recheckResults.find(
          recheckResult => recheckResult.route === routeObj
        );
      }),
      filter: routeObj.route.$isOpened.map(isOpened => !isOpened),
      target: routeObj.route.opened,
    });

    // Trigger .left() for the routes marked as "left"
    guard({
      clock: routesLeft.filterMap(recheckResults => {
        return recheckResults.find(
          recheckResult => recheckResult.route === routeObj
        );
      }),
      filter: routeObj.route.$isOpened,
      target: routeObj.route.left,
    });
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
