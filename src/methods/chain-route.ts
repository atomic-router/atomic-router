import {
  is,
  guard,
  merge,
  sample,
  combine,
  createStore,
  Unit,
  Clock,
  Effect,
  StoreValue,
  createEvent,
  NoInfer,
  EffectParams,
  attach,
} from 'effector';

import { createRoute } from './create-route';
import {
  RouteInstance,
  RouteParams,
  RouteParamsAndQuery,
  RouteQuery,
} from '../types';

import { isRoute } from './is-route';

type ChainRouteParamsInternalAttach<
  Params extends RouteParams,
  Query extends RouteQuery,
  FX extends Effect<any, any, any>
> = {
  route: RouteInstance<Params, Query>;
  chainedRoute?: RouteInstance<Params, Query>;
  beforeOpen: {
    effect: FX;
    mapParams: ({
      params,
      query,
    }: {
      params: Params;
      query: Query;
    }) => NoInfer<EffectParams<FX>>;
  };
  openOn?: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsWithEffect<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  route: RouteInstance<Params, Query>;
  chainedRoute?: RouteInstance<Params, Query>;
  beforeOpen: Effect<RouteParamsAndQuery<Params, Query>, any, any>;
};

type ChainRouteParamsAdvanced<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  route: RouteInstance<Params, Query>;
  chainedRoute?: RouteInstance<Params, Query>;
  beforeOpen: Clock<RouteParamsAndQuery<Params, Query>>;
  openOn: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsNormalized<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  route: RouteInstance<Params, Query>;
  chainedRoute: RouteInstance<Params, Query>;
  beforeOpen: Clock<RouteParamsAndQuery<Params, Query>>;
  openOn: Clock<any>;
  cancelOn: Clock<any>;
};

type chainRouteParams<
  Params extends RouteParams,
  Query extends RouteQuery,
  FX extends Effect<any, any, any>
> =
  | RouteInstance<Params, Query>
  | ChainRouteParamsWithEffect<Params, Query>
  | ChainRouteParamsAdvanced<Params, Query>
  | ChainRouteParamsInternalAttach<Params, Query, FX>;

function normalizeChainRouteParams<
  Params extends RouteParams,
  Query extends RouteQuery,
  FX extends Effect<any, any, any>
>(
  params: chainRouteParams<Params, Query, FX>
): ChainRouteParamsNormalized<Params, Query> {
  const resultParams: ChainRouteParamsNormalized<Params, Query> =
    {} as ChainRouteParamsNormalized<Params, Query>;
  if (isRoute(params)) {
    params;
    Object.assign(resultParams, {
      route: params,
      chainedRoute: createRoute<Params>(),
      beforeOpen: createEvent(),
      openOn: merge([params.opened, params.closed]),
      cancelOn: merge([createEvent()]),
    });
    return resultParams;
  }
  const effectParams = params as ChainRouteParamsWithEffect<Params, Query>;
  Object.assign(resultParams, {
    route: effectParams.route,
    chainedRoute: effectParams.chainedRoute || createRoute<Params>(),
    beforeOpen: is.unit(effectParams.beforeOpen)
      ? effectParams.beforeOpen
      : attach(effectParams.beforeOpen),
  });
  if (is.effect(resultParams.beforeOpen)) {
    Object.assign(resultParams, {
      openOn:
        // @ts-expect-error
        effectParams.openOn || resultParams.beforeOpen.doneData,
      cancelOn:
        // @ts-expect-error
        effectParams.cancelOn || resultParams.beforeOpen.failData,
    });
    return resultParams;
  }
  const advancedParams = params as ChainRouteParamsAdvanced<Params, Query>;
  Object.assign(resultParams, {
    openOn: sample({ clock: advancedParams.openOn as Unit<any> }),
    cancelOn: sample({
      clock: (advancedParams.cancelOn as Unit<any>) || createEvent(),
    }),
  });
  return resultParams;
}

function chainRoute<Params extends RouteParams, Query extends RouteQuery>(
  instance: RouteInstance<Params, Query>
): RouteInstance<Params, Query>;

function chainRoute<Params extends RouteParams, Query extends RouteQuery>(
  config: ChainRouteParamsWithEffect<Params, Query>
): RouteInstance<Params, Query>;

function chainRoute<Params extends RouteParams, Query extends RouteQuery>(
  config: ChainRouteParamsAdvanced<Params, Query>
): RouteInstance<Params, Query>;

function chainRoute<
  Params extends RouteParams,
  Query extends RouteQuery,
  FX extends Effect<any, any, any>
>(
  config: ChainRouteParamsInternalAttach<Params, Query, FX>
): RouteInstance<Params, Query>;

/**
 * Creates chained route
 * @link https://github.com/Kelin2025/atomic-router/issues/10
 * @param {RouteInstance<any>} params.route - Route to listen
 * @param {RouteInstance<any>} [params.chainedRoute]  - Route to be created
 * @param {Clock<any>} params.beforeOpen - Will be triggered when `params.route` open
 * @param {Clock<any>} params.openOn - Will open `chainedRoute` if `params.route` is still opened
 * @param {Clock<any>} params.cancelOn - Cancels chain
 * @returns {RouteInstance<any>} `chainedRoute`
 */
function chainRoute<
  Params extends RouteParams,
  Query extends RouteQuery,
  FX extends Effect<any, any, any>
>(params: chainRouteParams<Params, Query, FX>) {
  const { route, chainedRoute, beforeOpen, openOn, cancelOn } =
    normalizeChainRouteParams(params);
  const $params = createStore({} as StoreValue<typeof route['$params']>);
  const $query = createStore({} as StoreValue<typeof route['$query']>);
  const $hasSameParams = combine(
    combine([route.$params, route.$query]),
    combine([$params, $query]),
    (current, stored) => {
      return current[0] === stored[0] && current[1] === stored[1];
    }
  );
  const routeOpened = sample({
    clock: [route.opened, route.updated],
  });
  // 1. Call `beforeOpen` whenever route is opened
  sample({
    clock: routeOpened,
    target: beforeOpen as Unit<RouteParamsAndQuery<any, any>>,
  });
  $params.on(routeOpened, (_prev, { params }) => params);
  $query.on(routeOpened, (_prev, { query }) => query);
  // 2. Listen to `openOn` if route is still opened on the same position
  const chainedRouteResolved = guard({
    clock: openOn,
    source: { params: $params, query: $query },
    filter: $hasSameParams,
  });
  sample({
    clock: chainedRouteResolved,
    target: chainedRoute.navigate,
  });
  // 4. Cancel loading if page closed or `cancelOn` is called
  // @ts-expect-error
  const aborted = merge([route.closed, cancelOn]);
  $params.reset(aborted);
  $query.reset(aborted);
  sample({
    clock: aborted,
    target: chainedRoute.closed,
  });
  return chainedRoute;
}

// This is written separately to correctly export all type overloads
export { chainRoute };
