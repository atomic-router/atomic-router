import { createEffect } from "effector";
import { Route } from "../types";

type PathsMap = [Route<any, any, any>, string][];

// TODO: Toposort routes
export const attachPaths = createEffect((pathsMap: PathsMap) => {
  for (const [route, path] of pathsMap) {
    // @ts-expect-error
    if (route.virtual) {
      console.error(
        "[atomic-router] Virtual routes cannot have paths. Make sure you don't attach path to a chained route. Route: ",
        route
      );
    } else {
      // @ts-expect-error
      const parentPath = route.__.config.parent
        ? // @ts-expect-error
          route.__.config.parent.__.pathPattern + "/"
        : "";
      // @ts-expect-error Internal API usage
      route.__.pathPattern = `${parentPath}${path}`;
    }
  }
});
