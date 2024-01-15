import { match, compile } from "path-to-regexp";

import type { RouteParams, PathCreator, RouteQuery, ParamsSerializer } from "../types";

// NOTE: If path is URL - provide it as is
// Otherwise - extract pathname and hash
const getComparablePath = (path: string) => {
  if (path.match(/^[a-z0-9]+\:\/\//i)) {
    return path;
  }
  const url = new URL(`http://_${path}`);
  return [url.pathname, url.hash].join("");
};

// NOTE: path-to-regexp treats ":" in "https://" as param start
// So we escape it
function normalizePathCreator(pathCreator: string) {
  return pathCreator.replace("://", "\\://");
}

type BuildPathParams<Params extends RouteParams> = {
  pathCreator: PathCreator<Params>;
  params: Params;
  query: RouteQuery;
  serialize?: ParamsSerializer;
};
export function buildPath<Params extends RouteParams>({
  pathCreator,
  params,
  query,
  serialize,
}: BuildPathParams<Params>) {
  const pathname = compile(pathCreator)(params);
  const serializedParams = serialize?.write(query) ?? new URLSearchParams(query);
  const qs = Object.keys(query).length ? `?${serializedParams}` : "";
  const url = `${pathname}${qs}`;
  return url;
}

type MatchPathParams<Params extends RouteParams> = {
  pathCreator: PathCreator<Params>;
  actualPath: string;
};
export function matchPath<Params extends RouteParams>({
  pathCreator,
  actualPath,
}: MatchPathParams<Params>) {
  const matches = match(normalizePathCreator(pathCreator))(getComparablePath(actualPath));
  if (matches) {
    return { matches: true, params: matches.params } as const;
  }
  return { matches: false } as const;
}
