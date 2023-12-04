# Atomic Router

Simple routing implementation that provides abstraction layer instead of inline URL's and does not break your architecture

- Type-safe
- No inline URL's
- Atomic routes
- Does not break architecture
- Framework-agnostic
- Isomorphic (pass your own `history` instance and it works everywhere)

### Read the docs: [atomic-router.github.io](https://atomic-router.github.io)

> ❗️ **Attention**: At the moment atomic-router team collecting issues and feature requests to redesign and release update. Use current version of atomic-router on your own risk. We are going to write migration guide when/if the release will contain breaking changes. Thank you for reporting issues 🧡

### Get view-library bindings

- ⚛️ [**React**](https://github.com/atomic-router/react)
- 🍃 [**Forest**](https://github.com/atomic-router/forest)
- [**Solid**](https://github.com/atomic-router/solid)

## Installation

```bash
$ npm install effector atomic-router
```

## Initialization

Create your routes wherever you want:

```ts
// pages/home
import { createRoute } from 'atomic-router';
export const homeRoute = createRoute();

// pages/posts
import { createRoute } from 'atomic-router';
export const postsRoute = createRoute<{ postId: string }>();
```

And then create a router

```ts
// app/routing
import { createHistoryRouter } from 'atomic-router';
import { createBrowserHistory, createMemoryHistory } from 'history';
import { homeRoute } from '@/pages/home';
import { postsRoute } from '@/pages/posts';

const routes = [
  { path: '/', route: homeRoute },
  { path: '/posts', route: postsRoute },
];

const router = createHistoryRouter({
  routes: routes,
});

// Attach history
const history = isSsr ? createMemoryHistory() : createBrowserHistory();
router.setHistory(history);
```

## Why atomic routes?

There are 3 purposes for using atomic routes:

- To abstract the application from hard-coded paths
- To provide you a declarative API for a comfortable work
- To avoid extra responsibility in app features

## Examples

<details>
  <summary>Fetch post on page open</summary>

1. In your model, create effect and store which you'd like to trigger:

```tsx
export const getPostFx = createEffect<{ postId: string }, Post>(
  ({ postId }) => {
    return api.get(`/posts/${postId}`);
  }
);

export const $post = restore(getPostFx.doneData, null);
```

2. And just trigger it when `postPage.$params` change:

```tsx
//route.ts
import { createRoute } from 'atomic-router';
import { getPostFx } from './model';

const postPage = createRoute<{ postId: string }>();

sample({
  source: postPage.$params,
  filter: postPage.$isOpened,
  target: getPostFx,
});
```

</details>
<details>
  <summary>Avoid breaking architecture</summary>

Imagine that we have a good architecture, where our code can be presented as a dependency tree.  
 So, we don't make neither circular imports, nor they go backwards.  
 For example, we have `Card -> PostCard -> PostsList -> PostsPage` flow, where `PostsList` doesn't know about `PostsPage`, `PostCard` doesn't know about `PostsList` etc.

But now we need our `PostCard` to open `PostsPage` route.  
 And usually, we add extra responisbility by letting it know what the route is

```tsx
const PostCard = ({ id }) => {
  const post = usePost(id);

  return (
    <Card>
      <Card.Title>{post.title}</Card.Title>
      <Card.Description>{post.title}</Card.Description>
      {/* NOOOO! */}
      <Link to={postsPageRoute} params={{ postId: id }}>
        Read More
      </Link>
    </Card>
  );
};
```

With `atomic-router`, you can create a "personal" route for this card:

```tsx
const readMoreRoute = createRoute<{ postId: id }>();
```

And then you can just give it the same path as your `PostsPage` has:

```tsx
const routes = [
  { path: '/posts/:postId', route: readMoreRoute },
  { path: '/posts/:postId', route: postsPageRoute },
];
```

Both will work perfectly fine as they are completely independent

</details>

## API Reference

```tsx
// Params is an object-type describing query params for your route
const route = createRoute<Params>();

// Stores
route.$isOpened; // Store<boolean>
route.$params; // Store<{ [key]: string }>
route.$query; // Store<{ [key]: string }>

// Events (only watch 'em)
route.opened; // Event<{ params: RouteParams, query: RouteQuery }>
route.updated; // Event<{ params: RouteParams, query: RouteQuery }>
route.closed; // Event<{ params: RouteParams, query: RouteQuery }>

// Effects
route.open; // Effect<RouteParams>
route.navigate; // Effect<{ params: RouteParams, query: RouteQuery }>

// Note: Store, Event and Effect is imported from 'effector' package
```
