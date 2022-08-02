import { createMemoryHistory } from 'history';
import { allSettled, fork } from 'effector';
import { createHistoryRouter, createRoute } from '../src';

const firstRoute = createRoute();
const secondRoute = createRoute();
const notFoundRoute = createRoute();

const router = createHistoryRouter({
  routes: [
    { route: firstRoute, path: '/' },
    { route: secondRoute, path: '/second' },
  ],
  notFoundRoute,
});

describe('notFoundRoute', () => {
  it('matches not found route if really not found', async () => {
    const history = createMemoryHistory();
    history.push('/');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    expect(scope.getState(firstRoute.$isOpened)).toBe(true);
    expect(scope.getState(secondRoute.$isOpened)).toBe(false);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(false);

    await history.push('/second');
    expect(scope.getState(firstRoute.$isOpened)).toBe(false);
    expect(scope.getState(secondRoute.$isOpened)).toBe(true);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(false);

    await history.push('/not-really-found-route-check-it-path');
    expect(scope.getState(firstRoute.$isOpened)).toBe(false);
    expect(scope.getState(secondRoute.$isOpened)).toBe(false);
    expect(scope.getState(notFoundRoute.$isOpened)).toBe(true);
  });

  it('passes query params into not found route', async () => {
    const history = createMemoryHistory();
    history.push('/really-not-found?first=1');
    const scope = fork();
    await allSettled(router.setHistory, {
      scope,
      params: history,
    });

    expect(scope.getState(notFoundRoute.$query)).toEqual({ first: '1' });

    await history.push('/really-not-found?second=2');
    expect(scope.getState(notFoundRoute.$query)).toEqual({ second: '2' });
  });
});
