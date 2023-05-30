import {
  attach,
  combine,
  createEffect,
  createEvent,
  createStore,
  sample,
  scopeBind,
} from "effector";

import { equalsFilter } from "../lib/equals-filter";
import { Kind } from "../misc/kind";
import { rootDomain } from "../misc/root-domain";
import {
  EMPTY_PARAMS,
  EMPTY_QUERY,
  Route,
  RouteDomain,
  RouteParams,
  RouteParamsAndQuery,
  RouteQuery,
} from "../types";

export function createRoute<
  Params extends RouteParams = {},
  ParentParams extends RouteParams = {},
  DomainParams extends RouteParams = {}
>(
  config: {} & (
    | {
        params?: Params;
        parent?: Route<ParentParams, {}, DomainParams>;
        domain?: RouteDomain<DomainParams>;
        contract?: {
          query: any;
        };
      }
    | { virtual: true }
  ) = {}
) {
  // @ts-expect-error
  const domain: RouteDomain<DomainParams> = config?.domain ?? rootDomain;
  const actualConfig = {
    ...config,
    domain,
  };
  const __ = {
    pathPattern: "",
    config: actualConfig,
    openedByDomain: createEvent<RouteParamsAndQuery<Params>>(),
    closedByDomain: createEvent(),
  };

  const opened = createEvent();
  const updated = createEvent();
  const closed = createEvent();
  const prefetchRequested = createEvent();

  const $isOpened = createStore(false);
  const $params = createStore(EMPTY_PARAMS, {
    updateFilter: equalsFilter,
  });
  // @ts-expect-error
  const $query = config.virtual
    ? createStore(EMPTY_QUERY as RouteQuery)
    : combine($isOpened, domain.$query, (isOpened, query) => {
        return isOpened ? query : EMPTY_QUERY;
      });

  // createStore<RouteQuery>({}, { updateFilter: equalsFilter });

  const shape = {
    isOpened: $isOpened,
    params: $params,
    query: $query,
  };

  const $shape = combine(shape);

  const navigate = createEffect((payload) => {
    return payload;
  });
  const open = attach({
    effect: navigate,
    mapParams: (params) => {
      return { params, query: EMPTY_QUERY };
    },
  });

  const route: Route<Params, ParentParams, DomainParams> = {
    $isOpened,
    $params,
    $query,
    $shape,
    open,
    navigate,
    opened,
    updated,
    closed,
    prefetchRequested,
    __,
    kind: Kind.ROUTE,
    "@@unitShape": () => shape,
  };

  // @ts-expect-error
  if (actualConfig.virtual) {
    // @ts-ignore
    sample({
      clock: navigate,
      filter: $isOpened,
      fn: ({ params, query, replace }) => ({
        params,
        query,
        replace: replace || false,
      }),
      target: updated,
    });

    // @ts-ignore
    sample({
      clock: navigate,
      filter: $isOpened.map((isOpened) => !isOpened),
      fn: ({ params, query, replace }) => ({
        params,
        query,
        replace: replace || false,
      }),
      target: opened,
    });

    $isOpened.on([opened, updated], () => true);
    $params.on([opened, updated], (_, { params }) => params || EMPTY_PARAMS);
    $query.on([opened, updated], (_, { query }) => query);

    $isOpened.on(closed, () => false);
    $params.on(closed, (_) => EMPTY_PARAMS as Params);
    $query.on(closed, (_) => EMPTY_QUERY as RouteQuery);
  } else {
    // @ts-expect-error Internal API usage
    sample({
      clock: navigate,
      fn: ({ params, query, replace }) => ({
        route,
        params,
        query,
        replace: replace || false,
      }),
      // @ts-expect-error
      target: domain.__.routeNavigateTriggered,
    });

    sample({
      clock: __.openedByDomain,
      filter: $isOpened,
      target: updated,
    });

    sample({
      clock: __.openedByDomain,
      filter: $isOpened.map((isOpened) => !isOpened),
      target: opened,
    });

    sample({
      clock: __.closedByDomain,
      filter: $isOpened,
      target: closed,
    });

    $isOpened.on([opened, updated], () => true);
    $params.on([opened, updated], (_, { params }) => params || EMPTY_PARAMS);
    // $query.on([opened, updated], (_, { query }) => query);

    $isOpened.on(closed, () => false);
    $params.on(closed, (_) => EMPTY_PARAMS as Params);
    // $query.on(closed, (_) => (EMPTY_QUERY as RouteQuery));
  }

  // Add route to domain
  // @ts-expect-error
  domain.__.routes.push(route);

  return route;
}
