import { createEffect, createEvent } from 'effector';
import { createRoute, chainRoute } from '../src';
import { describe, it, expect, vi } from 'vitest';

const sleep = (t: number) => {
  return new Promise((r) => {
    setTimeout(r, t);
  });
};

describe('chainRoute', () => {
  it('Creates a chained route', async () => {
    const route = createRoute();
    const chainedRoute = chainRoute(route);
    await route.open({});
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('Effect in beforeOpen', async () => {
    const route = createRoute();
    const cb = vi.fn((_: any) => sleep(100));
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: fx,
    });
    await route.open({});
    expect(cb).toBeCalledTimes(1);
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('attach-like config in beforeOpen', async () => {
    const route = createRoute<{ x: string }>();
    const cb = vi.fn(async (payload: { param: string; queryParam: string }) => {
      await sleep(100);
      return payload;
    });
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
    await route.navigate({
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({ param: 'param', queryParam: 'query' });
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('openOn parameter', async () => {
    const route = createRoute<{ x: string }>();
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = vi.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    await route.navigate({
      replace: false,
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      replace: false,
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    openOn();
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('cancelOn parameter', async () => {
    const route = createRoute<{ x: string }>();
    const beforeOpen = createEvent<any>();
    const openOn = createEvent();
    const cancelOn = createEvent();
    const beforeOpenCb = vi.fn();
    beforeOpen.watch(beforeOpenCb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen,
      openOn,
      cancelOn,
    });
    await route.navigate({
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(beforeOpenCb).toBeCalledTimes(1);
    expect(beforeOpenCb).toBeCalledWith({
      replace: false,
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    cancelOn();
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    openOn();
    await sleep(100);
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
  });
});
