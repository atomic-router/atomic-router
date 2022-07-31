# createRouter

Creates router instance and sync routes state with the passed history instance.

## Usage

```ts
import { createHistoryRouter } from "atomic-router";
import { createBrowserHistory, createMemoryHistory } from "history";

import { homeRoute } from "@/pages/home";
import { postsRoute } from "@/pages/posts";
import { postRoute } from "@/pages/post";

// 1. Define routes
const routes = [
  { path: "/", route: homeRoute },
  { path: "/posts", route: postsRoute },
  { path: "/posts/:postId", route: postRoute },
];

// 2. Create router
const router = createHistoryRouter({
  routes: routes,
});

// 3. Create history
const history = isSsr ? createMemoryHistory() : createBrowserHistory();

// 4. Attach it to router
router.setHistory(history);
```

## `base` param

You can add an optional `base` param to `createHistoryRouter`:

```ts
const router = createHistoryRouter({
  base: "/dashboard",
  routes,
});
```

This will add `/dashboard` to all paths of the passed routes.
