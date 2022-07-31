# Data Fetching

In this example, we will demonstrate how to fetch data using `chainRoute`

## Task

Imagine that we have a classic "post page" situation.  
We want to fetch our post on route open and show a preloader during fetching.  
We also want to skip the next logic if we leave the route before loading is completed.

## Solution

First of all, let's create our route, effect that'll fetch data and the store

```ts
import { createRoute } from "atomic-router";
import { createEffect, restore } from "effector";

const postRoute = createRoute<{ postId: string }>();

const getPostFx = createEffect((postId: string) => {
  return fetch(/* ... */);
});

const $post = restore(getPostFx.doneData, null);
```

Now we need to fetch post whenever `postRoute` gets opened (or updated).

We can use `chainRoute` for that:

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

If you close `postRoute` during request, `chainRoute` will not open `postLoadedRoute` even if `getPostFx` will success.
:::

## Displaying preloaders

If you want to display spinner or skeleton preview, here's an elegant solution.

During loading, `postRoute.$isOpened` is `true`, but `postLoadedRoute.$isOpened` is `false`.

So, we can render page for the 1st one and display preloader for the 2nd one:

```tsx
import { useStore } from "effector-react";

import { $post, postLoadedRoute } from "./model";

export const PostPage = () => {
  const isPostLoadedRouteOpened = useStore(postLoadedRoute.$isOpened);

  if (isPostLoadedRouteOpened) {
    return; /* Loading */
  }

  return <Post />;
};

const Post = () => {
  const post = useStore($post);

  return (
    <article>
      <h1>{post.title}</h1>
      <div>{post.text}</div>
    </article>
  );
};
```

You can even create a loading queue (that's why it's called `chainRoute`):

```ts
import { createRoute, chainRoute } from "atomic-router";
import { createEffect, restore } from "effector";

export const postRoute = createRoute<{ postId: string }>();

export const getPostFx = createEffect(/* ... */);
export const getAuthorFx = createEffect(/* ... */);
export const getCommentsFx = createEffect(/* ... */);

export const $post = restore(getPostFx, null);
export const $author = restore(getAuthorFx, null);
export const $comments = restore(getCommentsFx, []);

export const postLoadedRoute = chainRoute({
  route: postRoute,
  beforeOpen: getPostFx,
});

export const authorLoadedRoute = chainRoute({
  route: postLoadedRoute,
  before: {
    effect: getUserFx,
    source: $post,
    mapParams: (_, post) => ({ userId: post.authorId }),
  },
});

export const commentsLoadedRoute = chainRoute({
  route: postLoadedRoute,
  before: {
    effect: getCommentsFx,
    source: $post,
    mapParams: (_, post) => ({ postId: post.id }),
  },
});

// Post route is opened, nothing loaded
postRoute.$isOpened;
// Only post loaded
postLoadedRoute.$isOpened;
// Author loaded
authorLoadedRoute.$isOpened;
// Comments loaded
commentsLoadedRoute.$isOpened;
```

This will allow you to precisely control which parts of the page to display.

## Handling errors

Since `chainRoute` just triggers passed effect, you can just subscribe to its response directly:

```ts
import { redirect } from "atomic-router";

import { notFoundRoute } from "@/shared/common-routes";

redirect({
  clock: getPostFx.failData,
  target: notFoundRoute,
});
```

Also, `chainRoute` has optional `openOn` and `cancelOn` parameters, in case you have a specific API:

```ts
import { split, createEffect, restore } from "effector";
import { createRoute, chainRoute, redirect } from "atomic-router";

import { notAllowedRoute } from "@/shared/common-routes";

const postRoute = createRoute<{ postId: string }>();

const getPostFx = createEffect(/* ... */);

// Split request result for public or private posts
const postRequestResult = split(getPostFx.doneData, {
  public: (post) => !post.private,
  private: (post) => post.private,
});

const $post = restore(postRequestResult.public, null);

// Will open only if post is public
const publicPostLoaded = chainRoute({
  route,
  beforeOpen: getPostFx,
  openOn: postRequestResult.public,
  cancelOn: [getPostFx.failData, postRequestResult.private],
});

// Redirect to notAllowedRoute if post is private
redirect({
  clock: postRequestResult.private,
  route: notAllowedRoute,
});
```
