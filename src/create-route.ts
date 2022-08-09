import {
  attach,
  createEffect,
  createEvent,
  createStore,
  sample,
  split,
  Store,
} from 'effector';
import {
  RouteParams,
  RouteParamsAndQuery,
  RouteQuery,
  RouteInstance,
  Kind,
} from './types';

type createRouteParams = {
  filter?: Store<boolean>;
};

export const createRoute = <Params extends RouteParams = {}>(
  params: createRouteParams = {}
) => {
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
  const closed = createEvent<void>();

  $isOpened.on(opened, () => true).on(closed, () => false);

  $params
    .on(opened, (_, { params }) => params)
    .on(updated, (_, { params }) => params);

  $query
    .on(opened, (_, { query }) => query)
    .on(updated, (_, { query }) => query);

  split({
    source: navigateFx.doneData,
    match: $isOpened.map((isOpened) => (isOpened ? 'updated' : 'opened')),
    cases: {
      opened,
      updated,
    },
  });

  // if (params.filter) {
  //   const filter = params.filter;
  //   split({
  //     // @ts-expect-error
  //     source: sample({ clock: filter }),
  //     // @ts-expect-error
  //     match: (filter) => (filter ? 'true' : 'false'),
  //     cases: {
  //       true: opened,
  //       false: closed,
  //     },
  //   });
  // }

  const instance: RouteInstance<Params> = {
    $isOpened,
    $params,
    $query,
    opened,
    updated,
    closed,
    navigate: navigateFx,
    open: openFx,
    kind: Kind.ROUTE,
    // @ts-expect-error Internal stuff
    settings: {
      derived: Boolean(params.filter),
    },
  };

  return instance;
};
