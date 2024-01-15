import { createEvent, createStore, type EventCallable, type StoreWritable } from "effector";

import type { RouteQuery } from "../types";
import { paramsEqual } from "../lib/equals";

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
