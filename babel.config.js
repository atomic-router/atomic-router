module.exports = {
  plugins: [
    [
      'effector/babel-plugin',
      {
        debugSids: true,
        factories: [
          './src/methods/chain-route',
          './src/methods/create-history-router',
          './src/methods/create-route',
          './src/methods/create-router-controls',
          './src/methods/is-route',
          './src/methods/new-create-history-router',
          './src/methods/redirect',
          './src',
        ],
      },
    ],
    ['@babel/plugin-proposal-class-properties', { loose: true }],
    '@babel/plugin-proposal-object-rest-spread',
    '@babel/plugin-proposal-optional-chaining',
    '@babel/plugin-proposal-nullish-coalescing-operator',
  ],
  presets: [
    ['@babel/preset-env', { loose: true }],
    ['@babel/preset-typescript'],
  ],
};
