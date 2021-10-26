# Atomic Router

Simple routing implementation that provides abstraction layer instead of inline URL's and does not break your architecture

- Type-safe
- No inline URL's
- Atomic routes
- Framework-agnostic
- Isomorphic (pass your own `history` instance)

## Installation
```bash
$ npm install effector atomic-router
```

## Initialization
Create your routes wherever you want:
```ts
// pages/home
export const homeRoute = createRoute()

// pages/posts
export const postsRoute = createRoute<{ postId: string }>()
```
And then create a router
```ts
// app/routing
import { homeRoute } from '@/pages/home'
import { postsRoute } from '@/pages/home'

const routes = [
  { path: '/', route: homeRoute },
  { path: '/posts', route: postsRoute },
]

createRouter({
  routes: routes,
  // Optional
  history: createBrowserHistory()
})
```

## Why atomic routes?
There are 3 purposes for using atomic routes:
- To abstract the application from hard-coded paths
- To provide you a declarative API for a comfortable work
- To avoid extra responsibility in app features

## Examples
<details>
  <summary>Fetch post on page open</summary>

  ```tsx
  // model.ts
  export const getPostFx = createEffect<{ postId:string }, Post>(({ postId }) => {
    return api.get(`/posts/${postId}`)
  })

  export const $post = restore(getPostFx.doneData, null)
  ```

  ```tsx
  //route.ts
  import { getPostFx } from './model'

  const postPage = createRoute<{ postId: string }>()

  guard({
    source: postPage.$params,
    filter: postPage.$isOpened,
    target: getPostFx
  })
  ```
</details>


## API Reference
```tsx
// Stores
route.$isOpened  // Store<boolean>
route.$params    // Store<{ [key]: string }>
route.$query     // Store<{ [key]: string }>

// Events (only watch 'em)
route.opened     // Event<{ params: RouteParams, query: RouteQuery }>
route.left       // Event<{ params: RouteParams, query: RouteQuery }>

// Effects
route.open       // Effect<RouteParams>
route.navigate   // Effect<{ params: RouteParams, query: RouteQuery }>
```
