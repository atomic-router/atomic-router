# Getting Started

## Installation

```bash
npm install effector atomic-router history
```

## View-library bindings

- [**React**](/views/react)
- [**Forest**](/views/forest)
- [**Solid**](/views/solid)

## Initialization

Create your routes wherever you want:

```ts
// @/pages/home
import { createRoute } from "atomic-router";

export const homeRoute = createRoute();

// @/pages/posts
import { createRoute } from "atomic-router";

export const postsRoute = createRoute<{ postId: string }>();
```

And then create a router

```ts
// @/app/routing
import { createHistoryRouter } from "atomic-router";
import { createBrowserHistory, createMemoryHistory } from "history";

import { homeRoute } from "@/pages/home";
import { postsRoute } from "@/pages/posts";

// 1. Define routes
const routes = [
  { path: "/", route: homeRoute },
  { path: "/posts", route: postsRoute },
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
