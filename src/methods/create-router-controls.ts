import { createEvent, createStore } from 'effector';

import { RouteQuery } from '../types';
import { paramsEqual } from '../utils/equals';

export const createRouterControls = () => {
  return {
    $query: createStore<RouteQuery>(
      {},
      {
        updateFilter: (update, current) => {
          console.log('controls $query updateFilter', {
            current,
            update,
            notEqual: !paramsEqual(current, update),
          });
          return !paramsEqual(current, update);
        },
      }
    ),
    back: createEvent(),
    forward: createEvent(),
  };
};
