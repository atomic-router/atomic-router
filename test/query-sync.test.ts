import { createMemoryHistory } from 'history';
import { describe, it, expect } from 'vitest';
import { allSettled, createEvent, createStore, fork, restore } from 'effector';

import {
  attachPaths,
  createRoute,
  createRouterDomain,
  querySync,
  setHistory,
} from '../src';

const createRouter = () => {
  const domain = createRouterDomain();

  const route = createRoute({ domain });
  const routeA = createRoute({ domain });
  const routeB = createRoute({ domain });
  const notOpenedRoute = createRoute({ domain });

  attachPaths([
    [route, '/'],
    [notOpenedRoute, '/not-opened'],
    [routeA, '/a'],
    [routeB, '/b'],
  ]);

  return { domain, route, routeA, routeB, notOpenedRoute };
};

describe('querySync', () => {
  it('Updates query when source is changed', async () => {
    const { domain } = createRouter();
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, '');

    querySync({
      source: { fromSource: $q },
      domain,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    await allSettled(qChanged, {
      scope,
      params: 'test',
    });

    expect(scope.getState(domain.$query)).toEqual({
      fromSource: 'test',
    });
    expect(history.location.search).toEqual(`?fromSource=test`);
  });

  it('Updates source when query is changed', async () => {
    const { domain } = createRouter();
    const $q = createStore('');

    querySync({
      source: { fromQuery: $q },
      domain,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    history.push('/?fromQuery=foo');

    expect(scope.getState($q)).toEqual('foo');
  });

  it('Sets source to defaultState if query param is missing', async () => {
    const { domain } = createRouter();
    const qChanged = createEvent<string>();
    const $q = createStore('defaultState');

    $q.on(qChanged, (prev, next) => next);

    querySync({
      source: { defaultState: $q },
      domain,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    await allSettled(qChanged, {
      scope,
      params: 'bar',
    });
    history.push('/?anotherQueryParam=test');

    expect(scope.getState($q)).toEqual('defaultState');
  });

  it('Ignore source updates if passed route is not opened', async () => {
    const { domain, notOpenedRoute } = createRouter();
    const qChanged = createEvent<string>();
    const $q = restore(qChanged, '');

    querySync({
      source: { shouldBeIgnored: $q },
      domain,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    await allSettled(qChanged, {
      scope,
      params: 'test',
    });

    expect(history.location.search).toEqual('');
  });

  it('Ignore history updates if passed route is not opened', async () => {
    const { domain, notOpenedRoute } = createRouter();
    const $q = createStore('');

    querySync({
      source: { q: $q },
      domain,
      route: notOpenedRoute,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
    });
    history.push('/?foo=bar');

    expect(scope.getState($q)).toEqual('');
  });

  it('Triggers history updates only on `clock` trigger (if present)', async () => {
    const { domain } = createRouter();
    const qChanged = createEvent<string>();
    const clock = createEvent();
    const $q = restore(qChanged, '');

    querySync({
      source: { q: $q },
      clock,
      domain,
    });

    const scope = fork();
    const history = createMemoryHistory();
    await allSettled(setHistory, {
      scope,
      params: { history, domain },
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

  describe('cleanup.irrelevant option', () => {
    it('Removes irrelevant params if set to true', async () => {
      const { domain, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q },
        route: routeA,
        domain,
        cleanup: {
          irrelevant: true,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      history.push('/a?foo=bar');

      expect(history.location.search).toEqual('?foo=bar');

      await allSettled(qChanged, {
        scope,
        params: 'test',
      });

      expect(history.location.search).toEqual('?q=test');
    });

    it('Keeps irrelevant params if set to false', async () => {
      const { domain, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q },
        route: routeA,
        domain,
        cleanup: {
          irrelevant: false,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      history.push('/a?foo=bar');

      expect(history.location.search).toEqual('?foo=bar');

      await allSettled(qChanged, {
        scope,
        params: 'test',
      });

      expect(history.location.search).toEqual('?foo=bar&q=test');
    });

    it('Keeps params passed to `preserve`', async () => {
      const { domain, routeA } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q },
        route: routeA,
        domain,
        cleanup: {
          irrelevant: true,
          preserve: ['foo'],
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      history.push('/a?foo=bar&bar=baz');

      expect(history.location.search).toEqual('?foo=bar&bar=baz');

      await allSettled(qChanged, {
        scope,
        params: 'test',
      });

      expect(history.location.search).toEqual('?foo=bar&q=test');
    });
  });

  describe('cleanup.empty option', () => {
    it('Removes empty params if set to true', async () => {
      const { domain } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q },
        domain,
        cleanup: {
          empty: true,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      await allSettled(qChanged, {
        scope,
        params: 'f',
      });

      expect(history.location.search).toEqual('?q=f');

      await allSettled(qChanged, {
        scope,
        params: '',
      });

      expect(history.location.search).toEqual('?');
    });

    it('Passes empty params if set to false', async () => {
      const { domain } = createRouter();
      const qChanged = createEvent<string>();
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q },
        domain,
        cleanup: {
          empty: false,
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      await allSettled(qChanged, {
        scope,
        params: 'f',
      });

      expect(history.location.search).toEqual('?q=f');

      await allSettled(qChanged, {
        scope,
        params: '',
      });

      expect(history.location.search).toEqual('?q=');
    });

    it('Preserves empty params if they are present in cleanup.preserve', async () => {
      const { domain } = createRouter();
      const fooChanged = createEvent<string>();
      const qChanged = createEvent<string>();
      const $foo = restore(qChanged, '');
      const $q = restore(qChanged, '');

      querySync({
        source: { q: $q, foo: $foo },
        domain,
        cleanup: {
          empty: true,
          preserve: ['q'],
        },
      });

      const scope = fork();
      const history = createMemoryHistory();
      await allSettled(setHistory, {
        scope,
        params: { history, domain },
      });
      await allSettled(qChanged, {
        scope,
        params: 'f',
      });
      await allSettled(fooChanged, {
        scope,
        params: 'f',
      });

      expect(history.location.search).toEqual('?q=f&foo=f');

      await allSettled(qChanged, {
        scope,
        params: '',
      });

      expect(history.location.search).toEqual('?q=');
    });
  });
});
