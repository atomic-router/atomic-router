import { parse } from 'qs';
import {
  attach,
  createEffect,
  guard,
  sample,
  createStore,
  createEvent,
  scopeBind,
} from 'effector';
import { History } from 'history';

import { RouteInstance, RouteQuery, PathParams } from './types';

import { buildPath, matchPath } from './build-path';

type RouteObject<Path extends string> = {
  path: Path;
  route: RouteInstance<PathParams<Path>>;
};

type HistoryPushParams<Path extends string> = {
  path: Path;
  params: PathParams<Path>;
  query: RouteQuery;
  method: 'replace' | 'push';
};

type HistoryPushPayload<Path extends string> = HistoryPushParams<Path> & {
  history: History;
};

type EnterParams<Path extends string, Params = PathParams<Path>> = {
  route: RouteObject<Path>;
  params: Params;
  query: RouteQuery;
};

type RecheckResult<Path extends string, Params = PathParams<Path>> = {
  route: RouteObject<Path>;
  params: Params;
  query: RouteQuery;
};

const historyPushFx = createEffect((pushParams: HistoryPushPayload<any>) => {
  if (!pushParams.history) {
    throw new Error('[Routing] No history provided');
  }
  pushParams.history[pushParams.method](pushParams.path, {});
  return pushParams;
});

export const createHistoryRouter = (params: {
  routes: RouteObject<any>[];
  hydrate?: boolean;
}) => {
  const setHistory = createEvent<History>();

  // @ts-expect-error
  const $history = createStore<History>(null).on(
    setHistory,
    (_, nextHistory) => nextHistory
  );

  // historyPushFx for the current history
  const pushFx = attach({
    effect: historyPushFx,
    source: { history: $history },
    mapParams: (params: HistoryPushParams<any>, { history }) => {
      return {
        history,
        ...params,
      };
    },
  });

  // Triggered whenever some route.open.doneData is triggered
  const enteredFx = createEffect(
    ({ route, params, query }: EnterParams<any>) => {
      const path = buildPath({ pathCreator: route.path, params, query });
      return { path, params, query, method: 'push' } as HistoryPushParams<
        typeof path
      >;
    }
  );

  // Recalculate entered/left routes
  const recheckFx = createEffect(
    ({ path, query }: { path: string; query: RouteQuery }) => {
      const entered = [] as RecheckResult<any>[];
      const left = [] as RecheckResult<any>[];

      for (const route of params.routes) {
        const { matches, params } = matchPath({
          pathCreator: route.path,
          actualPath: path,
        });
        (matches ? entered : left).push({ route, params, query });
      }

      return { entered, left };
    }
  );

  sample({
    clock: enteredFx.doneData,
    target: pushFx,
  });

  sample({
    clock: pushFx.doneData,
    target: recheckFx,
  });

  const routesEntered = recheckFx.doneData.map(({ entered }) => entered);
  const routesLeft = recheckFx.doneData.map(({ left }) => left);

  for (const routeObj of params.routes) {
    // Watch for route.open.doneData to build new path and push
    sample({
      clock: routeObj.route.navigate.doneData,
      fn: ({ params, query }) => ({ route: routeObj, params, query }),
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
  const recheck = attach({
    source: { history: $history },
    effect: async ({ history }) => {
      const [path, query] = [
        history.location.pathname,
        parse(history.location.search.slice(1)) as RouteQuery,
      ];
      return { path, query };
    },
  });

  sample({
    source: recheck.doneData,
    target: recheckFx,
  });

  // Triggered whenever history instance is set
  const subscribeHistory = attach({
    source: { history: $history },
    effect: async ({ history }) => {
      let scopedRecheck = recheck;
      try {
        // @ts-expect-error
        scopedRecheck = scopeBind(recheck);
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
      clock: subscribeHistory.doneData,
      target: recheck,
    });
  }

  sample({
    clock: $history,
    target: subscribeHistory,
  });

  return {
    $history,
    setHistory,
    push: pushFx,
    routes: params.routes,
  };
};
