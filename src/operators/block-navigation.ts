import { sample, Store } from "effector";
import { createNavigationBlocker } from "../methods/create-navigation-blocker";
import { rootDomain } from "../misc/root-domain";
import { RouteDomain, RouteParams } from "../types";

type Config<Params extends RouteParams> = {
  domain?: RouteDomain<Params>;
  filter: Store<boolean>;
};

export const blockNavigation = <Params extends RouteParams>(
  config: Config<Params>
) => {
  const navigationBlocker = createNavigationBlocker({
    domain: config?.domain ?? rootDomain,
  });

  sample({
    clock: config.filter,
    source: navigationBlocker.$confirmationMessage,
    filter: (_, filter) => filter === true,
    target: navigationBlocker.block,
  });

  sample({
    clock: config.filter,
    filter: (filter) => filter === false,
    target: navigationBlocker.unblock,
  });

  return navigationBlocker;
};
