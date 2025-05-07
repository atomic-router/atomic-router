import { Clock, combine, createStore, sample, Store, Unit } from "effector";

import { RouteInstance, RouteQuery } from "../types";
import { createRouterControls } from "./create-router-controls";

type QueryCleanupStrategy = {
  irrelevant: boolean;
  empty: boolean;
  preserve: string[];
};

type QuerySyncParams<T extends Record<string, Store<any>>> = {
  source: T;
  clock?: Clock<any>;
  controls: ReturnType<typeof createRouterControls>;
  route?: RouteInstance<any>;
  cleanup?: boolean | Partial<QueryCleanupStrategy>;
};

export function querySync<T extends Record<string, Store<any>>>(params: QuerySyncParams<T>) {
  const $isOpened = params.route?.$isOpened ?? createStore(true);
  const $source = combine(params.source);
  const clock = (params.clock ?? $source) as Unit<any>;
  const cleanupStrategy = !("cleanup" in params)
    ? cleanupStrategies.default
    : typeof params.cleanup === "boolean"
      ? cleanupStrategies[params.cleanup ? "all" : "none"]
      : { ...cleanupStrategies.default, ...params.cleanup! };

  const queryUpdatedFromHistory = sample({
    clock: params.controls.$query,
    filter: $isOpened,
  });

  sample({
    clock,
    source: [$source, params.controls.$query] as const,
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
    target: params.controls.$query,
  });

  for (const k in params.source) {
    const $queryParam = params.source[k as keyof typeof params.source];
    // @ts-expect-error
    $queryParam.on(queryUpdatedFromHistory, (_, query) => {
      return query[k] ?? $queryParam.defaultState;
    });
  }
}

const cleanupStrategies = {
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
