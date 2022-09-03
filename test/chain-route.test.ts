import { createEffect, createEvent } from 'effector';
import { createRoute, chainRoute } from '../src';
import { describe, it, expect, vi } from 'vitest';

describe('chainRoute', () => {
  it('Creates a chained route', () => {
    const route = createRoute();
    const chainedRoute = chainRoute(route);
    route.open({});
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('Effect in beforeOpen', () => {
    const route = createRoute();
    const cb = vi.fn((_: any) => {});
    const fx = createEffect(cb);
    const chainedRoute = chainRoute({
      route,
      beforeOpen: fx,
    });
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    route.open({});
    expect(cb).toBeCalledTimes(1);
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('attach-like config in beforeOpen', () => {
    const route = createRoute<{ x: string }>();
    const cb = vi.fn((payload: { param: string; queryParam: string }) => {
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
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    route.navigate({
      params: { x: 'param' },
      query: { foo: 'query' },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({ param: 'param', queryParam: 'query' });
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('openOn parameter', () => {
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
    route.navigate({
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
    expect(chainedRoute.$isOpened.getState()).toBeTruthy();
  });

  it('cancelOn parameter', () => {
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
    route.navigate({
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
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
    openOn();
    expect(chainedRoute.$isOpened.getState()).toBeFalsy();
  });
});
