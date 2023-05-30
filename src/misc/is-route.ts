import { Route } from "../types";
import { Kind } from "./kind";

/** Detects whether passed value is a `RouteInstance<any>` or not */
export const isRoute = (
  route: Route<any, any, any> | unknown
): route is Route<any, any, any> => {
  return (
    typeof route === "object" &&
    route !== null &&
    "kind" in route &&
    // @ts-expect-error
    route.kind === Kind.ROUTE
  );
};
