import { attach, createEvent, createStore, merge, sample } from "effector";
import { Transition } from "history";
import { rootDomain } from "../misc/root-domain";
import { RouteDomain, RouteParams } from "../types";

type Config<Params extends RouteParams> = {
  domain?: RouteDomain<Params>;
};

export class CancelledByNavigationError extends Error {}
export class PageLeaveNotConfirmedError extends Error {}

export const createNavigationBlocker = <Params extends RouteParams>(
  config: Config<Params>
) => {
  const domain = config?.domain ?? rootDomain;
  const navigationBlocked = createEvent<Transition>();
  const blockRequested = createEvent<string>();
  const unblockRequested = createEvent<any>();

  const $unblocker = createStore<Function | null>(null);
  const $transition = createStore<Transition | null>(null);
  const $confirmationMessage = createStore("Are you sure?");

  const $isNavigationBlocked = $unblocker.map(Boolean);

  const blockNavigationFx = attach({
    source: domain.$history,
    effect: (history) => {
      return history.block(navigationBlocked);
    },
  });

  const unblockNavigationFx = attach({
    source: $unblocker,
    effect: (unblock) => unblock && unblock(),
  });

  const confirmLeaveFx = attach({
    source: $confirmationMessage,
    effect: (confirmationMessage) => {
      // @ts-expect-error
      if (typeof confirm !== "undefined") {
        // @ts-expect-error
        const isConfirmed = confirm(confirmationMessage);
        if (isConfirmed) {
          return true;
        }
      }
      throw new PageLeaveNotConfirmedError("Not confirmed");
    },
  });

  const unblockAndRetryNavigationFx = attach({
    source: $unblocker,
    effect: (unblock, transition: Transition) => {
      unblock!();
      transition.retry();
    },
  });

  sample({
    clock: blockRequested,
    filter: $isNavigationBlocked.map(
      (isNavigationBlocked) => !isNavigationBlocked
    ),
    target: [blockNavigationFx, $confirmationMessage],
  });

  sample({
    clock: unblockRequested,
    filter: $isNavigationBlocked,
    target: unblockNavigationFx,
  });

  sample({
    clock: blockNavigationFx.doneData,
    target: $unblocker,
  });

  // Store transition and display confirmation upon page leave attempt
  sample({
    clock: navigationBlocked,
    target: [$transition, confirmLeaveFx],
  });

  sample({
    clock: confirmLeaveFx.doneData,
    source: $transition,
    filter: Boolean,
    target: unblockAndRetryNavigationFx,
  });

  sample({
    clock: [unblockAndRetryNavigationFx.doneData, unblockNavigationFx.doneData],
    fn: () => null,
    target: $unblocker,
  });

  return {
    /** Represents whether navigation is blocked or not */
    $isBlocked: $isNavigationBlocked,
    /** Contains a message to be shown in confirm window */
    $confirmationMessage,
    /** Trigger this one to block navigation */
    block: blockRequested,
    /** Trigger this one to unblock navigation */
    unblock: unblockRequested,
    /** This event is triggered whenever navigation is blocked */
    blocked: blockNavigationFx.doneData,
    /** This event is triggered whenever navigation is unblocked (whether manually or after pressing "OK" in page leave confirmation window) */
    unblocked: merge([
      unblockAndRetryNavigationFx.doneData,
      unblockNavigationFx.doneData,
    ]),
    /** This event is triggered after user pressed "OK" in page leave confirmation window and navigation became unblocked */
    leaveConfirmed: unblockAndRetryNavigationFx.doneData,
  };
};
