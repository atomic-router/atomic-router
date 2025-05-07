import { type Clock, type Event, type Store, createEvent, createStore, is, sample } from "effector";

import type { EmptyObject, RouteInstance, RouteParams, RouteQuery } from "../types";

type RedirectParams<T, Params extends RouteParams> = Params extends EmptyObject
  ? {
      clock?: Clock<T>;
      route: RouteInstance<{}>;
      query?: ((clock: T) => RouteQuery) | Store<RouteQuery> | RouteQuery;
      replace?: ((clock: T) => boolean) | Store<boolean> | boolean;
    }
  :
      | {
          clock?: Clock<T>;
          route: RouteInstance<Params>;
          params: ((clock: T) => Params) | Store<Params> | Params;
          query?: ((clock: T) => RouteQuery) | Store<RouteQuery> | RouteQuery;
          replace?: ((clock: T) => boolean) | Store<boolean> | boolean;
        }
      | {
          clock?: Clock<{
            params: Params;
            query?: RouteQuery;
            replace?: boolean;
          }>;
          route: RouteInstance<Params>;
          params?: ((clock: T) => Params) | Store<Params> | Params;
          query?: ((clock: T) => RouteQuery) | Store<RouteQuery> | RouteQuery;
          replace?: ((clock: T) => boolean) | Store<boolean> | boolean;
        };

/** Opens passed `route` upon `clock` trigger */
export function redirect<T, Params extends RouteParams>(options: RedirectParams<T, Params>) {
  const clock: Event<T> = options.clock
    ? sample({ clock: options.clock as Event<T> })
    : createEvent<T>();

  const params = toStore("params" in options ? options.params || {} : {});
  const query = toStore(options.query || {});
  const replace = toStore(options.replace || false);

  sample({
    clock: clock,
    source: { params, query, replace },
    fn: ({ params, query, replace }, clock) => ({
      params: fromClock(clock, params),
      query: fromClock(clock, query),
      replace: fromClock(clock, replace),
    }),
    target: options.route.navigate,
  });

  return clock;
}

function fromClock<Clock, Input extends {} | boolean>(
  clock: Clock,
  fn: ((clock: Clock) => Input) | Input,
): Input {
  if (typeof fn === "function") {
    return fn(clock);
  }
  return fn;
}

function toStore<T>(payload: T | Store<T>): Store<T> {
  return is.store(payload) ? payload : createStore(payload as T);
}
