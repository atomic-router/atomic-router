import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
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
  const $params = createStore<RouteParams>({});
  const $query = createStore<RouteQuery>({});

  const opened = createEvent<RouteParamsAndQuery<Params>>();
  const updated = createEvent<RouteParamsAndQuery<Params>>();
  const left = createEvent<void>();

  $isOpened.on(opened, () => true).on(left, () => false);

  $params
    .on(opened, (_, { params }) => params)
    .on(updated, (_, { params }) => params);

  $query
    .on(opened, (_, { query }) => query)
    .on(updated, (_, { query }) => query);

  sample({
    clock: navigateFx.doneData,
    target: opened,
  });

  return {
    $isOpened,
    $params,
    $query,
    opened,
    updated,
    left,
    navigate: navigateFx,
    open: openFx,
  } as RouteInstance<Params>;
};
