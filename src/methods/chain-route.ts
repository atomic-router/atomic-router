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
  FX extends Effect<any, any, any>
> = {
  route: RouteInstance<Params>;
  chainedRoute?: RouteInstance<Params>;
  beforeOpen: {
    effect: FX;
    mapParams: ({
      params,
      query,
    }: {
      params: Params;
      query: RouteQuery;
    }) => NoInfer<EffectParams<FX>>;
  };
  openOn?: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsWithEffect<Params extends RouteParams> = {
  route: RouteInstance<Params>;
  chainedRoute?: RouteInstance<Params>;
  beforeOpen: Effect<RouteParamsAndQuery<Params>, any, any>;
};

type ChainRouteParamsAdvanced<Params extends RouteParams> = {
  route: RouteInstance<Params>;
  chainedRoute?: RouteInstance<Params>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsNormalized<Params extends RouteParams> = {
  route: RouteInstance<Params>;
  chainedRoute: RouteInstance<Params>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn: Clock<any>;
};

type chainRouteParams<
  Params extends RouteParams,
  FX extends Effect<any, any, any>
> =
  | RouteInstance<Params>
  | ChainRouteParamsWithEffect<Params>
  | ChainRouteParamsAdvanced<Params>
  | ChainRouteParamsInternalAttach<Params, FX>;

function normalizeChainRouteParams<
  Params extends RouteParams,
  FX extends Effect<any, any, any>
>(params: chainRouteParams<Params, FX>): ChainRouteParamsNormalized<Params> {
  const resultParams: ChainRouteParamsNormalized<Params> =
    {} as ChainRouteParamsNormalized<Params>;
  if (isRoute(params)) {
    Object.assign(resultParams, {
      route: params,
      chainedRoute: createRoute<Params>(),
      beforeOpen: createEvent(),
      openOn: merge([params.opened, params.closed]),
      cancelOn: merge([createEvent()]),
    });
    return resultParams;
  }
  const effectParams = params as ChainRouteParamsWithEffect<Params>;
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
  const advancedParams = params as ChainRouteParamsAdvanced<Params>;
  Object.assign(resultParams, {
    openOn: sample({ clock: advancedParams.openOn as Unit<any> }),
    cancelOn: sample({
      clock: (advancedParams.cancelOn as Unit<any>) || createEvent(),
    }),
  });
  return resultParams;
}

function chainRoute<Params extends RouteParams>(
  instance: RouteInstance<Params>
): RouteInstance<Params>;

function chainRoute<Params extends RouteParams>(
  config: ChainRouteParamsWithEffect<Params>
): RouteInstance<Params>;

function chainRoute<Params extends RouteParams>(
  config: ChainRouteParamsAdvanced<Params>
): RouteInstance<Params>;

function chainRoute<
  Params extends RouteParams,
  FX extends Effect<any, any, any>
>(config: ChainRouteParamsInternalAttach<Params, FX>): RouteInstance<Params>;

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
  FX extends Effect<any, any, any>
>(params: chainRouteParams<Params, FX>) {
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
    target: beforeOpen as Unit<RouteParamsAndQuery<any>>,
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
