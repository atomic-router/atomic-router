import { Kind, RouteInstance, RouteInstanceInternal } from "../types";

/** Detects whether passed value is a `RouteInstance<any>` or not */
export function isRoute(route: RouteInstance<any> | unknown): route is RouteInstance<any> {
  return (
    typeof route === "object" && route !== null && "kind" in route && route.kind === Kind.ROUTE
  );
}

export function isRouteInternal(
  route: RouteInstanceInternal<any> | unknown,
): route is RouteInstanceInternal<any> {
  return isRoute(route);
}
