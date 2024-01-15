import { Clock, createEvent, createStore, Event, is, sample, Store } from "effector";
import { EmptyObject, RouteInstance, RouteParams, RouteQuery } from "../types";

type RedirectParams<T, Params extends RouteParams> = Params extends EmptyObject
  ? {
      clock?: Clock<T>;
      route: RouteInstance<Params>;
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

  const params = toStore(options.params || {});
  const query = toStore(options.query || {});
  const replace = toStore(options.replace || false);

  sample({
    clock: clock,
    source: { params, query, replace },
    fn: ({ params, query, replace }, clock) => ({
      params: typeof params === "function" ? params(clock) : params,
      query: typeof query === "function" ? query(clock) : query,
      replace: typeof replace === "function" ? replace(clock) : replace,
    }),
    target: options.route.navigate,
  });

  return clock;
}

function toStore<T>(payload: T | Store<T>): Store<T> {
  return is.store(payload) ? payload : createStore(payload as T);
}
