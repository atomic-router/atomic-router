export default {
  title: "Atomic Router",
  description: "Platform-agnostic router that does not break your architecture",
  themeConfig: {
    sidebar: [
      {
        text: "Introduction",
        items: [
          { text: "What is Atomic Router", link: "/" },
          { text: "Getting Started", link: "/getting-started" },
        ],
      },
      {
        text: "API",
        items: [
          { text: "createRoute", link: "/api/create-route" },
          { text: "createRouter", link: "/api/create-router" },
          { text: "redirect", link: "/api/redirect" },
          { text: "chainRoute", link: "/api/chain-route" },
        ],
      },
      {
        text: "Examples",
        items: [
          { text: "Data Fetching", link: "/examples/data-fetching" },
          { text: "Protected route", link: "/examples/protected-route" },
          { text: "Redirect", link: "/examples/redirect" },
          { text: "Query Params Sync", link: "/examples/query-params-sync" },
          { text: "SSR Support", link: "/examples/ssr" },
          { text: "Micro-frontends", link: "/examples/micro-frontends" },
          { text: "Browser extension", link: "/examples/browser-extension" },
        ],
      },
      {
        text: "View-library bindings",
        items: [
          {
            text: "React",
            link: "https://github.com/kelin2025/atomic-router-react",
          },
          {
            text: "Forest",
            link: "https://github.com/sergeysova/atomic-router-forest",
          },
          {
            text: "Solid",
            link: "https://github.com/Drevoed/atomic-router-solid",
          },
        ],
      },
    ],
  },
};
