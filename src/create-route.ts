import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
  split,
} from 'effector';
import {
  RouteParams,
  RouteParamsAndQuery,
  RouteQuery,
  RouteInstance,
} from './types';

export const createRoute = <Params extends RouteParams>() => {
  const navigateFx = createEffect(
    async ({ params, query }: RouteParamsAndQuery<Params>) => {
      return {
        params: params || {},
        query: query || {},
      } as RouteParamsAndQuery<Params>;
    }
  );

  const openFx = attach({
    effect: navigateFx,
    mapParams: (params: Params) => ({
      params: params || ({} as Params),
      query: {} as RouteQuery,
    }),
  });

  const $isOpened = createStore<boolean>(false);
  const $params = createStore<Params>({} as Params);
  const $query = createStore<RouteQuery>({});

  const opened = createEvent<RouteParamsAndQuery<Params>>();
  const updated = createEvent<RouteParamsAndQuery<Params>>();
  /** @deprecated Will be removed in 0.6.0. Use `route.closed` instead */
  const left = createEvent<void>();
  const closed = createEvent<void>();

  $isOpened.on(opened, () => true).on(left, () => false);

  $params
    .on(opened, (_, { params }) => params)
    .on(updated, (_, { params }) => params);

  $query
    .on(opened, (_, { query }) => query)
    .on(updated, (_, { query }) => query);

  split({
    source: navigateFx.doneData,
    match: $isOpened.map(isOpened => (isOpened ? 'updated' : 'opened')),
    cases: {
      opened,
      updated,
    },
  });

  sample({
    clock: closed,
    target: left,
  });

  const instance: RouteInstance<Params> = {
    $isOpened,
    $params,
    $query,
    opened,
    updated,
    closed,
    left,
    navigate: navigateFx,
    open: openFx,
  };

  return instance;
};
