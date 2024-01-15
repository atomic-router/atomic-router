import { createEvent, createStore } from "effector";

import { RouteQuery } from "../types";
import { paramsEqual } from "../utils/equals";

export const createRouterControls = () => {
  return {
    $query: createStore<RouteQuery>(
      {},
      {
        updateFilter: (update, current) => !paramsEqual(current, update),
      },
    ),
    back: createEvent(),
    forward: createEvent(),
  };
};
