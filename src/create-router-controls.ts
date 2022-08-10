import { createEvent, createStore } from 'effector';

import { RouteQuery } from './types';
import { paramsEqual } from './utils/equals';

export const createRouterControls = () => {
  return {
    $query: createStore<RouteQuery>(
      {},
      { updateFilter: (prev, next) => !paramsEqual(prev, next) }
    ),
    back: createEvent(),
    forward: createEvent(),
  };
};
