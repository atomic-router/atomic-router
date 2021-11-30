import { match, compile } from 'path-to-regexp';

import { PathParams, RouteParams, RouteQuery } from './types';

type BuildPathParams<Path extends string> = {
  pathCreator: Path;
  params: PathParams<Path>;
  query: RouteQuery;
};
export function buildPath<Path extends string>({
  pathCreator,
  params,
  query,
}: BuildPathParams<Path>) {
  const pathname = compile(pathCreator)(params);
  const qs = Object.keys(query).length
    ? `?${new URLSearchParams(query as Record<string, string>)}`
    : '';
  const url = `${pathname}${qs}`;
  return url;
}

type MatchPathParams<Path extends string> = {
  pathCreator: Path;
  actualPath: Path;
};
export function matchPath<Path extends string>({
  pathCreator,
  actualPath,
}: MatchPathParams<Path>) {
  const matches = match(pathCreator)(actualPath);
  if (matches) {
    const params = matches.params as RouteParams;
    return { matches: true, params: params } as const;
  }
  return { matches: false, params: {} as RouteParams } as const;
}
