import { UnmappedRouteObject, RouteObject } from "../types";

export function remapRouteObjects(objects: UnmappedRouteObject<any>[], basePath: string = "") {
  let next: RouteObject<any>[] = [];
  for (const routeObj of objects) {
    if (Array.isArray(routeObj.route)) {
      next.push(...routeObj.route.map((route) => ({ ...routeObj, route })));
    } else {
      // @ts-expect-error
      next.push(routeObj);
    }
  }
  next = next.map((routeObj) => ({
    ...routeObj,
    path: `${basePath}${routeObj.path}`,
  }));
  const derivedRoutes: RouteObject<any>[] = [];
  const nonDerivedRoutes: RouteObject<any>[] = [];
  for (const routeObj of next) {
    // @ts-expect-error Internals
    if (routeObj.route.settings.derived) {
      derivedRoutes.push(routeObj);
    } else {
      nonDerivedRoutes.push(routeObj);
    }
  }
  if (derivedRoutes.length) {
    for (const derivedRoute of derivedRoutes) {
      console.error(
        `createHistoryRouter: ${derivedRoute.path} uses derived route. This won't work`,
      );
    }
  }
  return nonDerivedRoutes;
}
