import { allSettled, fork } from 'effector';
import { describe, it, expect, vi } from 'vitest';
import { createRoute } from '../src';

const route = createRoute<{ postId: string }>();

describe('Routes creation', () => {
  it('Initialized with default values', () => {
    const scope = fork();
    expect(scope.getState(route.$isOpened)).toBe(false);
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe('.open() method', () => {
  it('Marks route as opened', async () => {
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
  });

  it('Stores route params in $params', async () => {
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: 'foo' });
  });

  it('Works without params passed', async () => {
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: undefined,
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });

  it('Resets $params to {} if no params passed', async () => {
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    await allSettled(route.open, {
      scope,
      params: undefined,
    });
    expect(scope.getState(route.$params)).toEqual({});
  });
});

describe('.navigate() method', () => {
  it('Marks route as opened', async () => {
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: {} },
    });
    expect(scope.getState(route.$isOpened)).toBe(true);
  });

  it('Stores route params in $params', async () => {
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: 'foo' });
  });

  it('Stores route query in $query', async () => {
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: { test: 'bar' } },
    });
    expect(scope.getState(route.$query)).toEqual({ test: 'bar' });
  });

  it('Resets $query on .open() trigger', async () => {
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: {} },
    });
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe('Lifecycle: .opened()', () => {
  it('Triggered on .open()/.navigate() calls', async () => {
    const cb = vi.fn();
    route.opened.watch(cb);
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: { test: 'blah' } },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({
      replace: false,
      params: { postId: 'foo' },
      query: { test: 'blah' },
    });
  });

  it('Does not get triggered if route is already opened', async () => {
    const cb = vi.fn();
    route.opened.watch(cb);
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    await allSettled(route.open, {
      scope,
      params: { postId: 'bar' },
    });
    expect(cb).toBeCalledTimes(1);
  });
});

describe('Lifecycle: .updated()', () => {
  it('Does not get triggered if route is not opened', async () => {
    const cb = vi.fn();
    route.updated.watch(cb);
    const scope = fork();
    await allSettled(route.open, {
      scope,
      params: { postId: 'foo' },
    });
    expect(cb).toBeCalledTimes(0);
  });

  it('Triggered on .open()/.navigate() calls if opened', async () => {
    const cb = vi.fn();
    route.updated.watch(cb);
    const scope = fork();
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'foo' }, query: { test: 'blah' } },
    });
    expect(cb).toHaveBeenCalledTimes(0);
    await allSettled(route.navigate, {
      scope,
      params: { params: { postId: 'bar' }, query: { test: 'baz' } },
    });
    expect(cb).toBeCalledTimes(1);
    expect(cb).toBeCalledWith({
      replace: false,
      params: { postId: 'bar' },
      query: { test: 'baz' },
    });
  });
});

describe('$params + $query', () => {
  it('Update on .opened()', async () => {
    const scope = fork();
    await allSettled(route.opened, {
      scope,
      params: { params: { postId: 'foo' }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: 'foo' });
  });

  it('Update on .updated()', async () => {
    const scope = fork();
    await allSettled(route.updated, {
      scope,
      params: { params: { postId: 'foo' }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: 'foo' });
  });

  it('Reset on .closed()', async () => {
    const scope = fork();
    await allSettled(route.closed, {
      scope,
      params: undefined,
    });
    expect(scope.getState(route.$params)).toEqual({});
  });
});
