import { match, compile } from 'path-to-regexp';

import { RouteParams, PathCreator, RouteQuery } from './types';

type BuildPathParams<Params extends RouteParams> = {
  pathCreator: PathCreator<Params>;
  params: Params;
  query: RouteQuery;
};
export function buildPath<Params extends RouteParams>({
  pathCreator,
  params,
  query,
}: BuildPathParams<Params>) {
  const pathname = compile(pathCreator)(params);
  const qs = Object.keys(query).length
    ? `?${new URLSearchParams(query as Record<string, string>)}`
    : '';
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
  const matches = match(pathCreator)(actualPath);
  if (matches) {
    return { matches: true, params: matches.params } as const;
  }
  return { matches: false } as const;
}
