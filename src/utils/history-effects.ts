import { History } from 'history';
import { createEffect } from 'effector';

import { HistoryBackForwardParams, HistoryPushParams } from '../types';

const checkHistory = (history: History) => {
  if (!history) {
    throw new Error('[Routing] No history provided');
  }
};

export const historyPushFx = createEffect((params: HistoryPushParams) => {
  checkHistory(params.history);
  params.history[params.method](params.path, {});
  return params;
});

export const historyBackFx = createEffect(
  (history: HistoryBackForwardParams) => {
    checkHistory(history);
    history.back();
    return history;
  }
);

export const historyForwardFx = createEffect(
  (history: HistoryBackForwardParams) => {
    checkHistory(history);
    history.forward();
    return history;
  }
);
