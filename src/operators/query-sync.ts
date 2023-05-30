import { Clock, combine, createStore, sample, Store, Unit } from "effector";
import { rootDomain } from "../misc/root-domain";

import { Route, RouteDomain, RouteQuery } from "../types";

type QueryCleanupStrategy = {
  irrelevant: boolean;
  empty: boolean;
  preserve: string[];
};

type QuerySyncConfig<T extends Record<string, Store<any>>> = {
  source: T;
  clock?: Clock<any>;
  domain?: RouteDomain<any>;
  route?: Route<any>;
  cleanup?: boolean | Partial<QueryCleanupStrategy>;
};

export function querySync<T extends Record<string, Store<any>>>(
  config: QuerySyncConfig<T>
) {
  const $isOpened = config.route?.$isOpened ?? createStore<boolean>(true);
  const $source = combine(config.source);
  const clock = (config.clock ?? $source) as Unit<any>;
  const domain = config.domain ?? rootDomain;
  const cleanupStrategy = !("cleanup" in config)
    ? cleanupStrategies.default
    : typeof config.cleanup === "boolean"
    ? cleanupStrategies[config.cleanup ? "all" : "none"]
    : { ...cleanupStrategies.default, ...config.cleanup! };

  const queryUpdatedFromHistory = sample({
    clock: domain.$query,
    filter: $isOpened,
  });

  sample({
    clock,
    source: combine([$source, domain.$query]),
    filter: $isOpened,
    fn: ([source, currentQuery]) => {
      let nextQuery: RouteQuery = {};
      if (cleanupStrategy.irrelevant) {
        for (const key of cleanupStrategy.preserve) {
          if (key in currentQuery) {
            nextQuery[key] = currentQuery[key];
          }
        }
      } else {
        nextQuery = { ...currentQuery };
      }
      for (const key in source) {
        nextQuery[key] = source[key];
      }
      if (cleanupStrategy.empty) {
        for (const key in source) {
          if (!cleanupStrategy.preserve.includes(key) && !nextQuery[key]) {
            delete nextQuery[key];
          }
        }
      }
      return nextQuery as RouteQuery;
    },
    target: domain.$query,
  });

  for (const k in config.source) {
    const $queryParam = config.source[k as keyof typeof config.source];
    $queryParam.on(queryUpdatedFromHistory, (_, query) => {
      return query[k] ?? $queryParam.defaultState;
    });
  }
}

export const cleanupStrategies = {
  all: {
    irrelevant: true,
    empty: true,
    preserve: [],
  },
  default: {
    irrelevant: false,
    empty: true,
    preserve: [],
  },
  none: {
    irrelevant: false,
    empty: false,
    preserve: [],
  },
};
