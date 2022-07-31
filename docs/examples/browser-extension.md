# Browser extension

Example with a browser extension and several routers.

## Task

Imagine that we have a browser extension.  
And we have a couple of specific websites with different routes for each other.  
We want to declare these routes and be able to subscribe to them without being scared of false-triggers on other websites.

## Solution

Since all the routes are atomic and routers are independent, we can easily create a separate router for each website and activate a specific one.

```ts
// @/services/opensea.io
import { createRoute, createHistoryRouter } from "atomic-router";

import * as routes from "./routes";

const domain = "opensea.io";

const router = createHistoryRouter({
  routes: [
    { route: routes.collection, path: "/collection/:collectionId" },
    { route: routes.asset, path: "/assets/:chain/:contractId/:assetId" },
    { route: routes.creator, path: "/:creatorId" },
  ],
});

export const service = { domain, router };
```

```ts
// @/services/app.uniswap.org
import { createRoute, createHistoryRouter } from "atomic-router";

import * as routes from "./routes";

const domain = "app.uniswap.org";

const router = createHistoryRouter({
  routes: [
    { route: routes.swap, path: "/swap" },
    { route: routes.createPoolFromTo, path: "/add/:from" },
    { route: routes.createPoolFromTo, path: "/add/:from/:to" },
  ],
});

export const service = { domain, router };
```

Then, we can create history instance and just attach it to the correct router:

```ts
// @/app/init.ts
import { createMemoryHistory } from "history";

import { service as opensea } from "@/services/opensea.io";
import { service as uniswap } from "@/services/app.uniswap.org";

const services = [opensea, uniswap];

// NOTE: Memory history is created instead of regular one
// Because websites usually intercept browser events
const createExtensionHistory = () => {
  const history = createMemoryHistory();
  const url = new URL(location.href);
  history.push(url.pathname + url.hash + url.search);
  chrome.runtime.onMessage.addListener((request) => {
    if (request.message === "url.changed") {
      const url = new URL(request.url!);
      if (location.host === url.host) {
        history.push(url.pathname + url.hash + url.search);
      }
    }
  });
  return history;
};

export const initializeRouter = createEffect(() => {
  if (!(location.host in services)) {
    throw new Error(`Service ${location.host} does not exist`);
  }
  const service = services[location.host];
  const history = createExtensionHistory();
  return service.router.setHistory(history);
});
```

Don't forget to add URL change handler to your background process:

```ts
// Notify content script about URL changes
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  // read changeInfo data and do something with it
  // like send the new url to contentscripts.js
  if (changeInfo.url) {
    chrome.tabs.sendMessage(tabId, {
      message: "url.changed",
      url: changeInfo.url,
    });
  }
});
```

Trigger `initializeRouter` on extension start and you're good!
