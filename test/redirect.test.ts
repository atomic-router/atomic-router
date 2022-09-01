import { createEvent, createStore } from 'effector';
import { createRoute, redirect } from '../src';

describe('redirect', () => {
  it('Opens `route` on `clock` trigger', () => {
    const clock = createEvent();
    const route = createRoute();

    redirect({
      clock,
      route,
    });

    clock();

    expect(route.$isOpened.getState()).toBeTruthy();
    expect(route.$params.getState()).toEqual({});
    expect(route.$query.getState()).toEqual({});
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

  //   clock({
  //     params: { foo: 'bar' },
  //     query: { baz: 'test' },
  //   });

  //   await sleep(0);

  //   expect(route.$isOpened.getState()).toBeTruthy();
  //   expect(route.$params.getState()).toEqual({ foo: 'bar' });
  //   expect(route.$query.getState()).toEqual({ baz: 'test' });
  // });

  it('Object-like `params` & `query`', () => {
    const clock = createEvent();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: { foo: 'bar' },
      query: { baz: 'test' },
      route,
    });

    clock();

    expect(route.$isOpened.getState()).toBeTruthy();
    expect(route.$params.getState()).toEqual({ foo: 'bar' });
    expect(route.$query.getState()).toEqual({ baz: 'test' });
  });

  it('Store-like `params` & `query`', () => {
    const clock = createEvent();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: createStore({ foo: 'bar' }),
      query: createStore({ baz: 'test' }),
      route,
    });

    clock();

    expect(route.$isOpened.getState()).toBeTruthy();
    expect(route.$params.getState()).toEqual({ foo: 'bar' });
    expect(route.$query.getState()).toEqual({ baz: 'test' });
  });

  it('Function-like `params` & `query`', () => {
    const clock = createEvent<string>();
    const route = createRoute<{ foo: string }>();

    redirect({
      clock,
      params: (foo) => ({ foo }),
      query: (foo) => ({ baz: `${foo}-test` }),
      route,
    });

    clock('bar');

    expect(route.$isOpened.getState()).toBeTruthy();
    expect(route.$params.getState()).toEqual({ foo: 'bar' });
    expect(route.$query.getState()).toEqual({ baz: 'bar-test' });
  });
});
