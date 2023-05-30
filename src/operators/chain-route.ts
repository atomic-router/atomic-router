import {
  attach,
  Clock,
  combine,
  createEffect,
  createEvent,
  createStore,
  Effect,
  EffectParams,
  is,
  merge,
  NoInfer,
  sample,
  Unit,
} from 'effector';

import { createRoute } from '../methods/create-route';
import {
  EMPTY_PARAMS,
  EMPTY_QUERY,
  ExtractRouteParams,
  ExtractRouteQuery,
  Route,
  RouteParams,
  RouteParamsAndQuery,
  RouteQuery,
} from '../types';

import { isRoute } from '../misc/is-route';

type ChainRouteParamsInternalAttach<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams,
  FX extends Effect<any, any, any>
> = {
  route: Route<Params, ParentParams, DomainParams>;
  chainedRoute?: Route<Params, ParentParams, DomainParams>;
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

type ChainRouteParamsWithEffect<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
> = {
  route: Route<Params, ParentParams, DomainParams>;
  chainedRoute?: Route<Params, ParentParams, DomainParams>;
  beforeOpen: Effect<RouteParamsAndQuery<Params>, any, any>;
};

type ChainRouteParamsAdvanced<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
> = {
  route: Route<Params, ParentParams, DomainParams>;
  chainedRoute?: Route<Params, ParentParams, DomainParams>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsNormalized<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
> = {
  route: Route<Params, ParentParams, DomainParams>;
  chainedRoute: Route<Params, ParentParams, DomainParams>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn: Clock<any>;
};

type chainRouteParams<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams,
  FX extends Effect<any, any, any>
> =
  | Route<Params, ParentParams, DomainParams>
  | ChainRouteParamsWithEffect<Params, ParentParams, DomainParams>
  | ChainRouteParamsAdvanced<Params, ParentParams, DomainParams>
  | ChainRouteParamsInternalAttach<Params, ParentParams, DomainParams, FX>;

function normalizeChainRouteParams<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams,
  FX extends Effect<any, any, any>
>(
  params: chainRouteParams<Params, ParentParams, DomainParams, FX>
): ChainRouteParamsNormalized<Params, ParentParams, DomainParams> {
  const resultParams: ChainRouteParamsNormalized<
    Params,
    ParentParams,
    DomainParams
  > = {} as ChainRouteParamsNormalized<Params, ParentParams, DomainParams>;
  if (isRoute(params)) {
    const beforeOpen = createEffect(() => {});
    Object.assign(resultParams, {
      route: params,
      chainedRoute: createRoute<Params, ParentParams, DomainParams>({
        virtual: true,
      }),
      beforeOpen: beforeOpen,
      openOn: beforeOpen.doneData,
      cancelOn: merge([createEvent()]),
    });
    return resultParams;
  }
  const effectParams = params as ChainRouteParamsWithEffect<
    Params,
    ParentParams,
    DomainParams
  >;
  Object.assign(resultParams, {
    route: effectParams.route,
    chainedRoute:
      effectParams.chainedRoute ||
      createRoute<Params, ParentParams, DomainParams>({ virtual: true }),
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
  const advancedParams = params as ChainRouteParamsAdvanced<
    Params,
    ParentParams,
    DomainParams
  >;
  Object.assign(resultParams, {
    // @ts-ignore
    openOn: sample({ clock: advancedParams.openOn as Unit<any> }),
    cancelOn: sample({
      clock: (advancedParams.cancelOn as Unit<any>) || createEvent(),
    }),
  });
  return resultParams;
}

function chainRoute<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
>(
  instance: Route<Params, ParentParams, DomainParams>
): Route<Params, ParentParams, DomainParams>;

function chainRoute<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
>(
  config: ChainRouteParamsWithEffect<Params, ParentParams, DomainParams>
): Route<Params, ParentParams, DomainParams>;

function chainRoute<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
>(
  config: ChainRouteParamsAdvanced<Params, ParentParams, DomainParams>
): Route<Params, ParentParams, DomainParams>;

function chainRoute<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams,
  FX extends Effect<any, any, any>
>(
  config: ChainRouteParamsInternalAttach<Params, ParentParams, DomainParams, FX>
): Route<Params, ParentParams, DomainParams>;

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
  ParentParams extends RouteParams,
  DomainParams extends RouteParams,
  FX extends Effect<any, any, any>
>(params: chainRouteParams<Params, ParentParams, DomainParams, FX>) {
  const { route, chainedRoute, beforeOpen, openOn, cancelOn } =
    normalizeChainRouteParams(params);
  const $params = createStore(EMPTY_PARAMS as ExtractRouteParams<typeof route>);
  const $query = createStore(EMPTY_QUERY as ExtractRouteQuery<typeof route>);
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
  const chainedRouteResolved = sample({
    clock: openOn as Unit<any>,
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
