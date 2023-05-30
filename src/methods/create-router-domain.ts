import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
  scopeBind,
} from 'effector';
import { History } from 'history';
import { compile, match } from 'path-to-regexp';
import { URLSearchParams } from 'url';
import { Kind } from '../misc/kind';
import {
  EMPTY_PARAMS,
  EMPTY_QUERY,
  Route,
  RouteDomain,
  RouteParams,
  RouteQuery,
} from '../types';

export const createRouterDomain = <Params extends RouteParams>(
  config: {
    params?: Params;
    base?: string;
  } = {}
) => {
  const base = config?.base ?? '';
  const __ = {
    routes: [],
    setHistory: createEvent(),
    routeNavigateTriggered: createEvent<{
      route: Route<any, any, RouteParams>;
      params: RouteParams;
      query: RouteQuery;
      replace?: boolean;
    }>(),
  };

  const recheck = createEvent();
  const initialized = createEvent();
  const historyChanged = createEvent<string>();

  const $activeRoutes = createStore<Route<any, any, RouteParams>[]>([]);
  const $history = createStore(null);
  const $unsubscribeCallback = createStore(function stub() {});
  const $query = createStore(EMPTY_QUERY);

  const updateRoutesStates = createEffect(
    (payload: {
      opened: {
        route: Route<any, any, RouteParams>;
        params: RouteParams;
      }[];
      closed: {
        route: Route<any, any, RouteParams>;
      }[];
      query: RouteQuery;
    }) => {
      for (const record of payload.closed) {
        // @ts-expect-error Internal API usage
        const closedByDomain = scopeBind(record.route.__.closedByDomain, {
          safe: true,
        });
        closedByDomain(undefined);
      }
      for (const record of payload.opened) {
        // @ts-expect-error Internal API usage
        const openedByDomain = scopeBind(record.route.__.openedByDomain, {
          safe: true,
        });
        openedByDomain({ params: record.params, query: payload.query });
      }
    }
  );

  const modifyHistory = attach({
    source: $history,
    effect: (history, params: { path: string; replace: boolean }) => {
      history[params.replace ? 'replace' : 'push'](`${base}${params.path}`);
    },
  });

  const push = attach({
    effect: modifyHistory,
    mapParams: (path: string) => ({ path, replace: false }),
  });

  const replace = attach({
    effect: modifyHistory,
    mapParams: (path: string) => ({ path, replace: true }),
  });

  const go = attach({
    source: $history,
    effect: (history, number: number) => {
      history.go(number);
    },
  });

  const back = attach({
    source: $history,
    effect: (history) => {
      history.back();
    },
  });

  const forward = attach({
    source: $history,
    effect: (history) => {
      history.forward();
    },
  });

  const manuallyUpdateQuery = attach({
    source: $history,
    effect: (history, params: { query: RouteQuery; replace: boolean }) => {
      const location = history.location;
      const query = new URLSearchParams(params.query);
      const fullPath = `${location.pathname}${query ? `?${query}` : ''}${
        location.hash
      }`;
      history[params.replace ? 'replace' : 'push'](fullPath);
    },
  });

  const subscribeHistory = attach({
    source: $unsubscribeCallback,
    effect: (unsubscribePreviousHistory, history: History) => {
      const localHistoryChanged = scopeBind(historyChanged);
      unsubscribePreviousHistory();
      return {
        unsubscribe: history.listen(({ location }) => {
          const fullPath = `${location.pathname}${location.hash}${location.search}`;
          localHistoryChanged(fullPath);
        }),
      };
    },
  });

  // History subscription
  sample({
    clock: __.setHistory,
    target: $history,
  });

  sample({
    clock: $history,
    target: subscribeHistory,
  });

  sample({
    clock: subscribeHistory.doneData,
    fn: ({ unsubscribe }) => unsubscribe,
    target: $unsubscribeCallback,
  });

  sample({
    clock: [historyChanged, subscribeHistory.doneData],
    target: recheck,
  });

  sample({
    clock: subscribeHistory.done,
    target: initialized,
  });

  // Push whenever Route navigation trigger received
  sample({
    clock: __.routeNavigateTriggered,
    fn: ({ route, params, query, replace }) => {
      // @ts-expect-error Internal API usage
      const pathname = compile(route.__.pathPattern)({ params });
      const qs = new URLSearchParams(query);
      const fullPath = `${base}${pathname}${`${qs}` ? `?${qs}` : ''}`;
      return {
        path: fullPath,
        replace: Boolean(replace),
      };
    },
    target: modifyHistory,
  });

  // Recheck
  sample({
    clock: recheck,
    source: $history,
    fn: (history) => {
      const opened = [];
      const closed = [];
      const query = Object.fromEntries(
        new URLSearchParams(history.location.search).entries()
      );
      for (const route of __.routes) {
        const fullPathPattern = `${base}${route.__.pathPattern}`;
        const fullPath = history.location.pathname + history.location.hash;
        const matched = match(fullPathPattern, {
          decode: decodeURIComponent,
        })(fullPath);
        if (matched) {
          const params = { ...(matched.params || EMPTY_PARAMS) };
          opened.push({ route, params });
        } else {
          closed.push({ route });
        }
      }
      return {
        opened,
        closed,
        query,
      };
    },
    target: updateRoutesStates,
  });

  // Query updating
  const $isUpdatingRoutesStates = createStore(false);

  $isUpdatingRoutesStates.on(updateRoutesStates, () => true);

  $query.on(updateRoutesStates, (prev, { query }) => query);

  sample({
    clock: $query,
    filter: $isUpdatingRoutesStates.map(
      (isUpdatingRoutesStates) => !isUpdatingRoutesStates
    ),
    fn: (query) => ({ query, replace: false }),
    target: manuallyUpdateQuery,
  });

  $isUpdatingRoutesStates.on(
    sample({ clock: updateRoutesStates }),
    () => false
  );

  // @ts-expect-error
  return {
    base: config?.base ?? '/',
    $activeRoutes,
    $query,
    $history,
    push,
    replace,
    go,
    back,
    forward,
    initialized,
    kind: Kind.DOMAIN,
    __,
  } as RouteDomain<Params>;
};
