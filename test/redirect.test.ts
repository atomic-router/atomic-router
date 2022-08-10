import { allSettled, createEvent, createStore, fork } from 'effector';
import { createRoute, redirect } from '../src';

describe('redirect', () => {
  it('Opens `route` on `clock` trigger', async () => {
    const clock = createEvent();
    const route = createRoute();

    redirect({
      clock,
      route,
    });

    const scope = fork();

    await allSettled(clock, { scope });

    expect(scope.getState(route.$isOpened)).toBeTruthy();
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });

  // TODO: Would be cool to make it default behavior
  // However, it'll be a breaking change
  // For now it's just { params: {}, query: {} } if `params/query` is empty
  // it('Takes `params` & `query` directly from `clock`', async () => {
  //   const clock = createEvent<{
  //     params: { foo: string };
  //     query: { baz: string };
  //   }>();
  //   const route = createRoute<{ foo: string }>();

  //   redirect({
  //     clock,
  //     route,
  //   });

  //   const scope = fork();
  //   await allSettled(clock, {
  //     scope,
  //     params: {
  //       params: { foo: 'bar' },
  //       query: { baz: 'test' },
  //     },
  //   });

  //   expect(scope.getState(route.$isOpened)).toBeTruthy();
  //   expect(scope.getState(route.$params)).toEqual({ foo: 'bar' });
  //   expect(scope.getState(route.$query)).toEqual({ baz: 'test' });
  // });

  it('Object-like `params` & `query`', async () => {
    const clock = createEvent();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: { foo: 'bar' },
      query: { baz: 'test' },
      route,
    });

    const scope = fork();
    await allSettled(clock, { scope });

    expect(scope.getState(route.$isOpened)).toBeTruthy();
    expect(scope.getState(route.$params)).toEqual({ foo: 'bar' });
    expect(scope.getState(route.$query)).toEqual({ baz: 'test' });
  });

  it('Store-like `params` & `query`', async () => {
    const clock = createEvent();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: createStore({ foo: 'bar' }),
      query: createStore({ baz: 'test' }),
      route,
    });

    const scope = fork();
    await allSettled(clock, { scope });

    expect(scope.getState(route.$isOpened)).toBeTruthy();
    expect(scope.getState(route.$params)).toEqual({ foo: 'bar' });
    expect(scope.getState(route.$query)).toEqual({ baz: 'test' });
  });

  it('Function-like `params` & `query`', async () => {
    const clock = createEvent<string>();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: (foo) => ({ foo }),
      query: (foo) => ({ baz: `${foo}-test` }),
      route,
    });

    const scope = fork();
    await allSettled(clock, { scope, params: 'bar' });

    expect(scope.getState(route.$isOpened)).toBeTruthy();
    expect(scope.getState(route.$params)).toEqual({ foo: 'bar' });
    expect(scope.getState(route.$query)).toEqual({
      baz: 'bar-test',
    });
  });
});
