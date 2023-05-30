import { RouteParams } from '../types';

// @ts-expect-error
export const declareParams = <T extends RouteParams>(): T => ({});
