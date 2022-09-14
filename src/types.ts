import { History } from 'history';
import { Effect, Event, Store } from 'effector';

export type RouteParams = Record<string, any>;

export type RouteQuery = Record<string, any>;

export type RouteParamsAndQuery<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  params: Params;
  query: Query;
};

export interface NavigateParams<
  Params extends RouteParams,
  Query extends RouteQuery
> extends RouteParamsAndQuery<Params, Query> {
  replace?: boolean;
}

export type RouteInstance<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  $isOpened: Store<boolean>;
  $params: Store<Params>;
  $query: Store<Query>;
  opened: Event<RouteParamsAndQuery<Params, Query>>;
  updated: Event<RouteParamsAndQuery<Params, Query>>;
  closed: Event<void>;
  navigate: Effect<
    NavigateParams<Params, Query>,
    NavigateParams<Params, Query>
  >;
  open: Effect<Params, RouteParamsAndQuery<Params, Query>>;
  kind: typeof Kind.ROUTE;
};

export type RouteObject<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  route: RouteInstance<Params, Query>;
  path: string;
};

export type UnmappedRouteObject<
  Params extends RouteParams,
  Query extends RouteQuery
> = {
  route: RouteInstance<Params, Query> | RouteInstance<Params, Query>[];
  path: string;
};

export type HistoryPushParams = {
  history: History;
  path: string;
  params: RouteParams;
  query: RouteQuery;
  method: 'replace' | 'push';
};

export type HistoryBackForwardParams = History;

export type ParamsSerializer = {
  write: (params: RouteParams) => string;
  read: (query: string) => RouteParams;
};

// @ts-expect-error
export type PathCreator<Params extends RouteParams> = string;

export const Kind = {
  ROUTE: Symbol(),
};
