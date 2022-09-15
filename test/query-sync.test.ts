import { createMemoryHistory } from 'history';
import { describe, it, expect } from 'vitest';
import { allSettled, createEvent, createStore, fork, restore } from 'effector';

import {
  createRoute,
  createHistoryRouter,
  querySync,
  createRouterControls,
} from '../src';

const route = createRoute();
const notOpenedRoute = createRoute();

const controls = createRouterControls();

const router = createHistoryRouter({
  routes: [
    { path: '/', route },
    { path: '/not-opened', route: notOpenedRoute },
  ],
  controls,
});

describe('querySync', () => {
  it('Updates query when source is changed', async () => {
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, '');

    querySync({
      source: { q: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: 'test',
    });

    expect(scope.getState(controls.$query)).toEqual({
      q: 'test',
    });
    expect(history.location.search).toEqual(`?q=test`);
  });

  it('Updates source when query is changed', async () => {
    const $q = createStore('');

    querySync({
      source: { q: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/?q=foo');

    expect(scope.getState($q)).toEqual('foo');
  });

  it('Sets source to defaultState if query param is missing', async () => {
    const qChanged = createEvent<string>();
    const $q = createStore('defaultState');

    $q.on(qChanged, (prev, next) => next);

    querySync({
      source: { q: $q },
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: 'foo',
    });
    history.push('/?foo=test');

    expect(scope.getState($q)).toEqual('defaultState');
  });

  it('Ignore source updates if passed route is not opened', async () => {
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, '');

    querySync({
      source: { q: $q },
      controls,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: 'test',
    });

    expect(history.location.search).toEqual('');
  });

  it('Ignore history updates if passed route is not opened', async () => {
    const $q = createStore('');

    querySync({
      source: { q: $q },
      controls,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    history.push('/?foo=bar');

    expect(scope.getState($q)).toEqual('');
  });

  it('Triggers history updates only on `clock` trigger (if present)', async () => {
    const qChanged = createEvent<string>();
    const clock = createEvent();
    const $q = restore(qChanged, '');

    querySync({
      source: { q: $q },
      clock,
      controls,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });
    await allSettled(qChanged, {
      scope,
      params: 'test',
    });
    await allSettled(qChanged, {
      scope,
      params: 'bar',
    });

    expect(history.location.search).toEqual('');

    await allSettled(clock, {
      scope,
    });
    expect(history.location.search).toEqual('?q=bar');
  });
});
