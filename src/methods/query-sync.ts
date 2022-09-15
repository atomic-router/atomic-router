import { Clock, combine, createStore, sample, Store, Unit } from 'effector';

import { RouteInstance, RouteQuery } from '../types';
import { createRouterControls } from './create-router-controls';

type QuerySyncParams<T extends Record<string, Store<any>>> = {
  source: T;
  clock?: Clock<any>;
  controls: ReturnType<typeof createRouterControls>;
  route?: RouteInstance<any>;
};

export function querySync<T extends Record<string, Store<any>>>(
  params: QuerySyncParams<T>
) {
  const $isOpened = params.route?.$isOpened ?? createStore(true);
  const $source = combine(params.source);
  const clock = (params.clock ?? $source) as Unit<any>;

  const queryUpdated = sample({
    clock: params.controls.$query,
    filter: $isOpened,
  });

  sample({
    clock,
    source: combine([$source, params.controls.$query]),
    filter: $isOpened,
    fn: ([source, currentQuery]) => {
      return { ...currentQuery, ...source } as RouteQuery;
    },
    target: params.controls.$query,
  });

  for (const k in params.source) {
    const $queryParam = params.source[k as keyof typeof params.source];

    $queryParam.on(queryUpdated, (_, query) => {
      return query[k] ?? $queryParam.defaultState;
    });
  }
}
