# chainRoute

Creates a virtual route that opens after specific request completion.

## Usage

```ts
import { createRoute, chainRoute } from "atomic-router";
import { createEffect, restore } from "effector";

const postRoute = createRoute<{ postId: string }>();

const getPostFx = createEffect((postId: string) => {
  return fetch(/* ... */);
});

const $post = restore(getPostFx.doneData);

const postLoadedRoute = chainRoute({
  route: postRoute,
  beforeOpen: {
    effect: getPostFx,
    mapParams: ({ params }) => params.postId,
  },
});
```

::: tip The following is read as:
Whenever `postRoute.opened/updated` is triggered,  
Trigger `getPostFx` with `params.postId`,  
And open `postLoadedRoute` on `getPostFx.doneData`.

---

If you close `postRoute` during request, `postLoadedRoute` won't be opened even if `getPostFx.doneData` will be triggered.
:::

## Advanced usage

If you need more precise control or doesn't have _some Promise-thing_ to wait, you there's `openOn` and `cancelOn` params:

```ts
import { createRoute, chainRoute } from "atomic-router";
import { createEvent } from "effector";

const route = createRoute();

const sessionCheckStarted = createEvent();
const sessionEstablished = createEvent();
const sessionCheckFailed = createEvent();

const authorizedRoute = chainRoute({
  route: route,
  beforeOpen: sessionCheckStarted,
  openOn: sessionEstablished,
  cancelOn: sessionCheckFailed,
});
```

::: tip The following is read as:
Whenever `route.opened/updated` is triggered,  
Trigger `sessionCheckStarted`,  
And open `authorizedRoute` on `sessionEstablished`.

---

If you either close `route` or `sessionCheckFailed` is triggered before `sessionEstablished`, `authorizedRoute` won't be opened even if `sessionEstablished` will be triggered.
:::

All `beforeOpen`, `openOn` and `cancelOn` params also support array of units:

```ts
const postCommentsLoadedRoute = chainRoute({
  route: postRoute,
  beforeOpen: getCommentsFx,
  openOn: getCommentsFx.doneData,
  cancelOn: [getCommentsFx.failData, currentPostDeleted],
});
```

## `chainedRoute` param

If you want to open already-defined route, you can use `chainedRoute` param:

```ts
const postRoute = createRoute<{ postId: string }>();
const postLoadedRoute = createRoute<{ postId: string }>();

chainRoute({
  route: postRoute,
  beforeOpen: getPostFx,
  chainedRoute: postLoadedRoute,
});
```
