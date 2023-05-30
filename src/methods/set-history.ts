import { createEffect, scopeBind } from "effector";
import { History } from "history";

import { rootDomain } from "../misc/root-domain";
import { RouteDomain } from "../types";

type Config = {
  domain?: RouteDomain<any>;
  history: History;
};

export const setHistory = createEffect((config: Config) => {
  const domain = config?.domain ?? rootDomain;

  // @ts-expect-error Internal API usage
  const localSetHistory = scopeBind(domain.__.setHistory, { safe: true });

  localSetHistory(config.history);
});
