module.exports = {
  plugins: [
    [
      "effector/babel-plugin",
      {
        factories: [
          "./src/methods/chain-route",
          "./src/methods/create-history-router",
          "./src/methods/create-route",
          "./src/methods/create-router-controls",
          "./src/methods/is-route",
          "./src/methods/new-create-history-router",
          "./src/methods/redirect",
          "./src",
        ],
      },
    ],
    ["@babel/plugin-transform-class-properties", { loose: true }],
    "@babel/plugin-transform-object-rest-spread",
    "@babel/plugin-transform-optional-chaining",
    "@babel/plugin-transform-nullish-coalescing-operator",
  ],
  presets: [["@babel/preset-env", { loose: true }], ["@babel/preset-typescript"]],
};
