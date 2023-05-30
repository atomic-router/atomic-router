import { Effect, Event, Store, StoreValue } from "effector";
import { History } from "history";
import { A } from "ts-toolbelt";
import { Kind } from "./misc/kind";

type ObjectFromList<T extends ReadonlyArray<string>, V = string> = {
  [K in T extends ReadonlyArray<infer U> ? U : never]: V;
};

type Concat<T> = T extends [infer A, ...infer Rest]
  ? A extends Readonly<any[]>
    ? [...A, ...Concat<Rest>]
    : A
  : T;

export type UnTuple<Params extends ReadonlyArray<string>> = ObjectFromList<
  Params,
  string
>;

// add an element to the end of a tuple
type Push<L extends Readonly<any[]>, T> = ((r: any, ...x: L) => void) extends (
  ...x: infer L2
) => void
  ? { [K in keyof L2]-?: K extends keyof L ? L[K] : T }
  : never;

// convert a union to an intersection: X | Y | Z ==> X & Y & Z
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

// convert a union to an overloaded function X | Y ==> ((x: X)=>void) & ((y:Y)=>void)
type UnionToOvlds<U> = UnionToIntersection<
  U extends any ? (f: U) => void : never
>;

// convert a union to a tuple X | Y => [X, Y]
// a union of too many elements will become an array instead
export type UnionToTuple<U> = UTT0<U> extends infer T
  ? T extends Readonly<any[]>
    ? Exclude<U, T[number]> extends never
      ? T
      : U[]
    : never
  : never;

type UTT0<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTT1<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTT1<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTT2<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTT2<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTT3<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTT3<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTT4<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTT4<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTT5<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTT5<U> = UnionToOvlds<U> extends (a: infer A) => void
  ? Push<UTTX<Exclude<U, A>>, A>
  : Readonly<[]>;
type UTTX<U> = Readonly<[]>; // bail out

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
          "flat"
        >
      > & { replace?: boolean }
    >,
    void
  >;
  open: Event<
    A.Compute<Params & Partial<ParentParams> & Partial<DomainParams>, "flat">
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
  ? StoreValue<T["$query"]>
  : never;

export type EmptyObject = { [key in string]: never };

export const EMPTY_PARAMS: RouteParams = {};
export const EMPTY_QUERY: RouteQuery = {};
