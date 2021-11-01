# Atomic Router

Simple routing implementation that provides abstraction layer instead of inline URL's and does not break your architecture

- Type-safe
- No inline URL's
- Atomic routes
- Does not break architecture
- Framework-agnostic
- Isomorphic (pass your own `history` instance and it works everywhere)

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

const router = createHistoryRouter({
  routes: routes
})

// Attach history
const history = isSsr ? createMemoryHistory() : createBrowserHistory();
router.setHistory(history)
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
  export const getPostFx = createEffect<{ postId:string }, Post>(({ postId }) => {
    return api.get(`/posts/${postId}`)
  })
  
  export const $post = restore(getPostFx.doneData, null)
  ```

  2. And just trigger it when `postPage.$params` change:
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
<details>
  <summary>Avoid breaking architecture</summary>

  Imagine that we have a good architecture, where our code can be presented as a dependency tree.  
  So, we don't make neither circular imports, nor they go backwards.  
  For example, we have `Card -> PostCard -> PostsList -> PostsPage` flow, where `PostsList` doesn't know about `PostsPage`, `PostCard` doesn't know about `PostsList` etc.  
    
  But now we need our `PostCard` to open `PostsPage` route.  
  And usually, we add extra responisbility by letting it know what the route is

  ```tsx
  const PostCard = ({ id }) => {
    const post = usePost(id)

    return (
      <Card>
        <Card.Title>{post.title}</Card.Title>
        <Card.Description>{post.title}</Card.Description>
        {/* NOOOO! */}
        <Link to={postsPageRoute} params={{ postId: id }}>Read More</Link>
      </Card>
    )
  }
  ```

  With `atomic-router`, you can create a "personal" route for this card:
  ```tsx
  const readMoreRoute = createRoute<{{ postId: id }}>()
  ```
  
  And then you can just give it the same path as your `PostsPage` has:

  ```tsx
  const routes = [
    { path: '/posts/:postId', route: readMoreRoute },
    { path: '/posts/:postId', route: postsPageRoute },
  ]
  ```

  Both will work perfectly fine as they are completely independent
</details>

## API Reference
```tsx
// Stores
route.$isOpened  // Store<boolean>
route.$params    // Store<{ [key]: string }>
route.$query     // Store<{ [key]: string }>

// Events (only watch 'em)
route.opened     // Event<{ params: RouteParams, query: RouteQuery }>
route.updated    // Event<{ params: RouteParams, query: RouteQuery }>
route.left       // Event<{ params: RouteParams, query: RouteQuery }>

// Effects
route.open       // Effect<RouteParams>
route.navigate   // Effect<{ params: RouteParams, query: RouteQuery }>
```
