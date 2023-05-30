import { Effect, Event, Store, StoreValue } from 'effector';
import { History } from 'history';
import { A } from 'ts-toolbelt';
import { Kind } from './misc/kind';

export type RouteParams = Record<string, string>;

export type RouteQuery = {
  [k in string]: string;
};

export type RouteParamsAndQuery<Params extends RouteParams> = {
  params: Params;
  query: RouteQuery;
};

export type Route<
  Params extends RouteParams,
  ParentParams extends RouteParams,
  DomainParams extends RouteParams
> = {
  $isOpened: Store<boolean>;
  $params: Store<Params>;
  $query: Store<RouteQuery>;
  $shape: Store<{
    isOpened: boolean;
    params: Params;
    query: RouteQuery;
  }>;
  navigate: Effect<
    A.Compute<
      RouteParamsAndQuery<
        // @ts-expect-error
        A.Compute<
          Params & Partial<ParentParams> & Partial<DomainParams>,
          'flat'
        >
      > & { replace?: boolean }
    >,
    void
  >;
  open: Event<
    A.Compute<Params & Partial<ParentParams> & Partial<DomainParams>, 'flat'>
  >;
  opened: Event<Params>;
  updated: Event<Params>;
  closed: Event<void>;
  prefetchRequested: Event<void>;
  kind: typeof Kind.ROUTE;
};

export type RouteDomain<Params extends RouteParams> = {
  base: string;
  params: Params;
  $activeRoutes: Store<Route<any, any, any>[]>;
  $query: Store<RouteQuery>;
  $history: Store<History>;
  push: Effect<string, any>;
  replace: Effect<string, any>;
  go: Effect<number, void>;
  back: Effect<void, void>;
  forward: Effect<void, void>;
  initialized: Event<void>;
  kind: typeof Kind.DOMAIN;
  __params: Params;
};

export type ExtractRouteParams<T extends unknown> = T extends Route<
  infer Params
>
  ? Params
  : never;

export type ExtractRouteQuery<T extends unknown> = T extends Route<any>
  ? StoreValue<T['$query']>
  : never;

export type EmptyObject = { [key in string]: never };

export const EMPTY_PARAMS: RouteParams = {};
export const EMPTY_QUERY: RouteQuery = {};
