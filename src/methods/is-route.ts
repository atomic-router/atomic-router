import { Kind, RouteInstance } from '../types';

/** Detects whether passed value is a `RouteInstance<any>` or not */
export const isRoute = (
  route: RouteInstance<any, any> | unknown
): route is RouteInstance<any, any> => {
  return (
    typeof route === 'object' &&
    route !== null &&
    'kind' in route &&
    // @ts-expect-error
    route.kind === Kind.ROUTE
  );
};
