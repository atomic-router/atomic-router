# redirect

Declarative operator for setting up redirects on a certain events

## Usage

```ts
import { createEvent } from "effector";
import { createRoute, redirect } from "atomic-router";

const goHomePressed = createEvent<MouseEvent>();

const homeRoute = createRoute();

redirect({
  clock: goHomePressed,
  target: homeRoute,
});
```

When `goHomePressed` is triggered, it'll open `homeRoute`

## Passing params

You can pass parameters in different ways:

### 1. Object notation - static params/query

```ts
import { createEvent } from "effector";
import { createRoute, redirect } from "atomic-router";

const readMorePressed = createEvent<MouseEvent>();

const readPostRoute = createRoute<{ postId: string }>();

redirect({
  clock: readMorePressed,
  params: { postId: 1 },
  query: { foo: "bar" },
  target: readPostRoute,
});
```

### 2. Store notation - dynamic params/query taken from store

```ts
import { createRoute, redirect } from "atomic-router";
import { createStore, createEvent } from "effector";

const readPostRoute = createRoute<{ postId: string }>();

const readMorePressed = createEvent<MouseEvent>();

const $post = createStore({ postId: 1 });

redirect({
  clock: editPostPressed,
  params: $post,
  query: $someQuery,
  target: editPostRoute,
});
```

### 3. Function notation - get params/query directly from clock

```ts
import { createRoute, redirect } from "atomic-router";
import { createStore, createEvent } from "effector";

const readPostRoute = createRoute<{ postId: string }>();

const readPostPressed = createEvent<{ postId: string }>();

redirect({
  clock: editPostPressed,
  params: (payload) => ({ postId: payload.postId }),
  target: editPostRoute,
});
```

## Return redirect

You can skip `clock` param to create `Event` that will trigger redirect.

it's useful in combination with `split` and other operators:

```ts
import { split, createEffect } from 'effector'
import { createRoute, redirect } from "atomic-router";

import { notFoundRoute, notAuthorizedRoute } from '@/shared/common-routes'

const getPostFx = createEffect(() => /* ... */)

split({
  source: getPostFx,
  match: {
    401: err => err.code === 401,
    404: err => err.code === 404,
  },
  cases: {
    401: redirect({ route: notAuthorizedRoute }),
    401: redirect({ route: notFoundRoute }),
  }
})
```
