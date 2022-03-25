import {
  is,
  guard,
  sample,
  combine,
  createStore,
  Unit,
  Clock,
  Effect,
  StoreValue,
  createEvent,
} from 'effector';

import { createRoute } from '../create-route';
import { RouteInstance, RouteParamsAndQuery } from '../types';

import { isRoute } from './is-route';

type ChainRouteParamsWithEffect<Params> = {
  route: RouteInstance<Params>;
  chainedRoute?: RouteInstance<Params>;
  beforeOpen: Effect<RouteParamsAndQuery<Params>, any, any>;
};

type ChainRouteParamsAdvanced<Params> = {
  route: RouteInstance<Params>;
  chainedRoute?: RouteInstance<Params>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn?: Clock<any>;
};

type ChainRouteParamsNormalized<Params> = {
  route: RouteInstance<Params>;
  chainedRoute: RouteInstance<Params>;
  beforeOpen: Clock<RouteParamsAndQuery<Params>>;
  openOn: Clock<any>;
  cancelOn: Clock<any>;
};

type chainRouteParams<Params> =
  | RouteInstance<Params>
  | ChainRouteParamsWithEffect<Params>
  | ChainRouteParamsAdvanced<Params>;

const normalizeChainRouteParams = <Params>(
  params: chainRouteParams<Params>
): ChainRouteParamsNormalized<Params> => {
  if (isRoute(params)) {
    return {
      route: params,
      chainedRoute: createRoute<Params>(),
      beforeOpen: createEvent(),
      openOn: [params.opened, params.closed],
      cancelOn: [createEvent()],
    };
  }
  const effectParams = params as ChainRouteParamsWithEffect<Params>;
  if (!('enterOn' in effectParams) && is.effect(effectParams.beforeOpen)) {
    return {
      route: effectParams.route,
      chainedRoute: effectParams.chainedRoute || createRoute<Params>(),
      beforeOpen: effectParams.beforeOpen,
      openOn: effectParams.beforeOpen.doneData,
      cancelOn: effectParams.beforeOpen.failData,
    };
  }
  const advancedParams = params as ChainRouteParamsAdvanced<Params>;
  return {
    route: advancedParams.route,
    chainedRoute: advancedParams.chainedRoute || createRoute<Params>(),
    beforeOpen: advancedParams.beforeOpen,
    openOn: sample({ clock: advancedParams.openOn }),
    cancelOn: sample({ clock: advancedParams.cancelOn || createEvent() }),
  };
};

/**
 * Creates chained route
 * @link https://github.com/Kelin2025/atomic-router/issues/10
 * @param {RouteInstance<any>} params.route - Route to listen
 * @param {RouteInstance<any>} [params.chainedRoute]  - Route to be created
 * @param {Clock<any>} params.beforeOpen - Will be triggered when `params.route` open
 * @param {Clock<any>} params.enterOn - Will open `chainedRoute` if `params.route` is still opened
 * @param {Clock<any>} params.cancelOn - Cancels chain
 * @returns {RouteInstance<any>} `chainedRoute`
 */
export const chainRoute = <Params>(params: chainRouteParams<Params>) => {
  const {
    route,
    chainedRoute,
    beforeOpen,
    openOn,
    cancelOn,
  } = normalizeChainRouteParams(params);
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
};
