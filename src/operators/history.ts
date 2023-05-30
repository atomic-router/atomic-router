import { Clock, createEvent, Event, sample, Unit } from "effector";
import { rootDomain } from "../misc/root-domain";
import { RouteDomain } from "../types";

export type NavigateConfig = {
  domain?: RouteDomain<any>;
  replace?: boolean;
} & (
  | {
      clock?: Clock<string>;
    }
  | { path: string }
);

export type BackForwardConfig = {
  domain?: RouteDomain<any>;
  clock?: Clock<any>;
};

export type GoConfig = {
  domain?: RouteDomain<any>;
  clock?: Clock<number>;
};

export const navigate = <T extends NavigateConfig>(config: T) => {
  const event: Event<T extends { path: string } ? void : string> =
    // @ts-expect-error
    config?.clock ?? createEvent();
  const domain = config?.domain ?? rootDomain;

  sample({
    clock: event as Unit<string>,
    // @ts-expect-error
    fn: (payload) => config?.path ?? payload,
    target: domain[config.replace ? "replace" : "push"],
  });

  return event;
};

export const goBack = (config: BackForwardConfig) => {
  const event = config?.clock ?? createEvent();
  const domain = config?.domain ?? rootDomain;

  sample({
    clock: event as Unit<void>,
    target: domain.back,
  });

  return event;
};

export const goForward = (config: BackForwardConfig) => {
  const event = config?.clock ?? createEvent();
  const domain = config?.domain ?? rootDomain;

  sample({
    clock: event as Unit<void>,
    target: domain.forward,
  });

  return event;
};

export const go = (config: GoConfig) => {
  const event = config?.clock ?? createEvent<number>();
  const domain = config?.domain ?? rootDomain;

  sample({
    clock: event as Unit<number>,
    target: domain.go,
  });

  return event;
};
