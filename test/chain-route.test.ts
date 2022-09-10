import { allSettled, createEffect, createEvent, fork } from 'effector';
import { createRoute, chainRoute } from '../src';

const sleep = (t: number) => {
  return new Promise((r) => {
    setTimeout(r, t);
  });
};

describe('chainRoute', () => {
  it('Creates a chained route', async () => {
    const route = createRoute();
    const chainedRoute = chainRoute(route);
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: {},
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it('Effect in beforeOpen', async () => {
    const route = createRoute();
    const cb = jest.fn((_: any) => sleep(100));
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: fx,
    });
    const scope = fork();
    const promise = allSettled(route.open, {
      scope,
      params: {},
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await promise;
    expect(cb).toBeCalledTimes(1);
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it('attach-like config in beforeOpen', async () => {
    const route = createRoute<{ x: string }>();
    const cb = jest.fn(
      async (payload: { param: string; queryParam: string }) => {
        await sleep(100);
        return payload;
      }
    );
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: {
        effect: fx,
        mapParams: ({ params, query }) => ({
          param: params.x,
          queryParam: query.foo,
        }),
      },
    });
    const scope = fork();
    const promise = allSettled(route.navigate, {
      scope,
      params: {
        params: { x: 'param' },
        query: { foo: 'query' },
      },
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await promise;
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({ param: 'param', queryParam: 'query' });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it('openOn parameter', async () => {
    const route = createRoute<{ x: string }>();
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = jest.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: {
        replace: false,
        params: { x: 'param' },
        query: { foo: 'query' },
      },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      replace: false,
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(openOn, {
      scope,
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeTruthy();
  });

  it('cancelOn parameter', async () => {
    const route = createRoute<{ x: string }>();
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = jest.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: {
        params: { x: 'param' },
        query: { foo: 'query' },
      },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      params: { x: 'param' },
      query: { foo: 'query' },
      replace: false,
    });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(cancelOn, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
    await allSettled(openOn, { scope });
    expect(scope.getState(chainedRoute.$isOpened)).toBeFalsy();
  });
});
