import { type EventCallable, type StoreWritable, createEvent, createStore } from "effector";

import { paramsEqual } from "../lib/equals";
import type { RouteQuery } from "../types";

interface RouterControls {
  $query: StoreWritable<RouteQuery>;
  back: EventCallable<void>;
  forward: EventCallable<void>;
}

export function createRouterControls(): RouterControls {
  return {
    $query: createStore({}, { updateFilter: (update, current) => !paramsEqual(current, update) }),
    back: createEvent(),
    forward: createEvent(),
  };
}
