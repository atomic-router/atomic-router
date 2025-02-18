export { createRoute } from "./methods/create-route";
export { createHistoryRouter } from "./methods/create-history-router";
export { createRouterControls } from "./methods/create-router-controls";
export { isRoute } from "./methods/is-route";
export { redirect } from "./methods/redirect";
export { chainRoute } from "./methods/chain-route";
export { querySync } from "./methods/query-sync";

export * from "./lib/build-path";

export type {
  RouteParams,
  RouteQuery,
  NavigateParams,
  RouteParamsAndQuery,
  RouteInstance,
  RouteObject,
  RouteObjectInternal,
  UnmappedRouteObject,
  HistoryBackForwardParams,
  HistoryPushParams,
  ParamsSerializer,
  PathCreator,
  EmptyObject,
} from "./types";
export { Kind } from "./types";
