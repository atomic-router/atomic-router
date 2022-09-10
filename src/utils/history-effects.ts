import { History } from 'history';
import { createEffect } from 'effector';

import { HistoryBackForwardParams, HistoryPushParams } from '../types';

function assertHistory(history: History) {
  if (!history) {
    throw new Error('[Routing] No history provided');
  }
}

export const historyPushFx = createEffect((params: HistoryPushParams) => {
  assertHistory(params.history);
  params.history[params.method](params.path, {});
  return params;
});

export const historyBackFx = createEffect(
  (history: HistoryBackForwardParams) => {
    assertHistory(history);
    history.back();
    return history;
  }
);

export const historyForwardFx = createEffect(
  (history: HistoryBackForwardParams) => {
    assertHistory(history);
    history.forward();
    return history;
  }
);
